const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Support application/x-www-form-urlencoded (OAuth clients + login form) and JSON
router.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// In-memory stores (single-use, short-lived)
// ---------------------------------------------------------------------------
/** @type {Map<string, object>} authorization codes awaiting token exchange */
const authCodes = new Map();
/** @type {Map<string, object>} pending login sessions (avoids mangling PKCE params in the HTML form) */
const pendingLogins = new Map();

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days (matches login JWT)

function cleanupExpired() {
    const now = Date.now();
    for (const [code, data] of authCodes.entries()) {
        if (data.expiresAt <= now || data.used) {
            authCodes.delete(code);
        }
    }
    for (const [id, data] of pendingLogins.entries()) {
        if (data.expiresAt <= now) {
            pendingLogins.delete(id);
        }
    }
}

function generateRandomToken() {
    return crypto.randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// PKCE helpers (RFC 7636)
// code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
// ---------------------------------------------------------------------------

/**
 * Base64url encode a Buffer: no padding, + → -, / → _
 */
function base64UrlEncode(buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

/**
 * Normalize a challenge string for comparison (trim + force base64url form).
 */
function normalizeBase64Url(value) {
    return String(value || '')
        .trim()
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
        .replace(/\s+/g, ''); // drop any accidental whitespace
}

/**
 * Recompute S256 code_challenge from code_verifier.
 */
function computeS256Challenge(codeVerifier) {
    // RFC 7636: SHA256 over ASCII code_verifier, then base64url
    const hash = crypto
        .createHash('sha256')
        .update(String(codeVerifier), 'ascii')
        .digest();
    return base64UrlEncode(hash);
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Simple HTML login page. Only carries a short-lived login_session id so
 * code_challenge is never re-encoded through the HTML form body.
 */
function renderLoginForm({ login_session, error }) {
    const errorHtml = error
        ? `<p class="error">${escapeHtml(error)}</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — Cricket Auction</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,.35);
    }
    h1 { margin: 0 0 .25rem; font-size: 1.35rem; }
    .sub { color: #94a3b8; font-size: .9rem; margin: 0 0 1.5rem; }
    label { display: block; font-size: .85rem; margin-bottom: .35rem; color: #cbd5e1; }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: .65rem .75rem;
      margin-bottom: 1rem;
      border: 1px solid #475569;
      border-radius: 8px;
      background: #0f172a;
      color: #f1f5f9;
      font-size: 1rem;
    }
    input:focus { outline: 2px solid #38bdf8; border-color: transparent; }
    button {
      width: 100%;
      padding: .75rem;
      border: none;
      border-radius: 8px;
      background: #0ea5e9;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #0284c7; }
    .error {
      background: #7f1d1d;
      color: #fecaca;
      border: 1px solid #991b1b;
      border-radius: 8px;
      padding: .65rem .75rem;
      margin: 0 0 1rem;
      font-size: .9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Cricket Auction</h1>
    <p class="sub">Sign in to authorize this application</p>
    ${errorHtml}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="login_session" value="${escapeHtml(login_session)}" />

      <label for="email">Email</label>
      <input id="email" type="email" name="email" required autocomplete="username" />

      <label for="password">Password</label>
      <input id="password" type="password" name="password" required autocomplete="current-password" />

      <button type="submit">Sign in &amp; Authorize</button>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Validate OAuth authorize params (GET query).
 * Returns { ok: true, params } or { ok: false, status, body }.
 */
function validateAuthorizeParams(source) {
    const response_type = source.response_type;
    const client_id = source.client_id;
    const redirect_uri = source.redirect_uri;
    // Preserve challenge exactly as sent (only trim outer whitespace)
    const code_challenge = source.code_challenge
        ? String(source.code_challenge).trim()
        : '';
    const code_challenge_method = source.code_challenge_method || 'S256';
    const state = source.state || '';
    const scope = source.scope || '';

    if (response_type !== 'code') {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'unsupported_response_type',
                error_description: 'Only response_type=code is supported',
            },
        };
    }

    if (!client_id) {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'invalid_request',
                error_description: 'client_id is required',
            },
        };
    }

    if (!redirect_uri) {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'invalid_request',
                error_description: 'redirect_uri is required',
            },
        };
    }

    if (!code_challenge) {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'invalid_request',
                error_description: 'code_challenge is required (PKCE)',
            },
        };
    }

    if (code_challenge_method !== 'S256') {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'invalid_request',
                error_description: 'Only code_challenge_method=S256 is supported',
            },
        };
    }

    try {
        new URL(redirect_uri);
    } catch {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'invalid_request',
                error_description: 'Invalid redirect_uri',
            },
        };
    }

    return {
        ok: true,
        params: {
            response_type,
            client_id,
            redirect_uri,
            code_challenge,
            code_challenge_method,
            state,
            scope,
        },
    };
}

/**
 * GET /oauth/authorize
 *
 * Validates OAuth params, stores them in a short-lived login session
 * (so code_challenge is never passed through the HTML form), shows login form.
 */
router.get('/authorize', (req, res) => {
    const result = validateAuthorizeParams(req.query);
    if (!result.ok) {
        return res.status(result.status).json(result.body);
    }

    cleanupExpired();

    const loginSession = generateRandomToken();
    pendingLogins.set(loginSession, {
        ...result.params,
        expiresAt: Date.now() + PENDING_LOGIN_TTL_MS,
    });

    console.log('[oauth/authorize GET] stored login session PKCE challenge:', result.params.code_challenge);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLoginForm({ login_session: loginSession }));
});

/**
 * POST /oauth/authorize
 *
 * Login form submit → verify credentials → issue one-time auth code → redirect.
 */
router.post('/authorize', async (req, res) => {
    cleanupExpired();

    const { login_session, email, password } = req.body || {};
    const pool = req.app.get('db');

    const pending = login_session ? pendingLogins.get(login_session) : null;

    const sendFormError = (message, sessionId) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        // Keep the same session so user can retry without losing OAuth params
        return res.status(401).send(
            renderLoginForm({
                login_session: sessionId || login_session || '',
                error: message,
            })
        );
    };

    if (!pending || pending.expiresAt <= Date.now()) {
        return res.status(400).send(
            '<!DOCTYPE html><html><body><p>Authorization session expired. Please restart the OAuth flow.</p></body></html>'
        );
    }

    if (!email || !password) {
        return sendFormError('Email and password are required', login_session);
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return sendFormError('Invalid email or password', login_session);
        }

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return sendFormError('Invalid email or password', login_session);
        }

        if (!user.email_verified) {
            return sendFormError(
                'Please verify your email before signing in. Check your inbox for a verification code.',
                login_session
            );
        }

        // Consume login session (one successful login per authorize attempt)
        pendingLogins.delete(login_session);

        const code = generateRandomToken();
        const record = {
            code,
            codeChallenge: pending.code_challenge,
            codeChallengeMethod: pending.code_challenge_method,
            redirectUri: pending.redirect_uri,
            clientId: pending.client_id,
            userId: user.id,
            scope: pending.scope || '',
            expiresAt: Date.now() + AUTH_CODE_TTL_MS,
            used: false,
        };

        authCodes.set(code, record);

        console.log('[oauth/authorize POST] issued auth code; stored challenge:', record.codeChallenge);
        console.log('[oauth/authorize POST] method:', record.codeChallengeMethod, 'userId:', record.userId);

        const redirectUrl = new URL(pending.redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (pending.state) {
            redirectUrl.searchParams.set('state', pending.state);
        }

        return res.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('OAuth authorize login error:', error);
        return sendFormError('Something went wrong. Please try again.', login_session);
    }
});

/**
 * POST /oauth/token
 *
 * Exchange authorization code + code_verifier for a JWT access token.
 */
router.post('/token', (req, res) => {
    const {
        grant_type,
        code,
        redirect_uri,
        client_id,
        code_verifier,
    } = req.body || {};

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only grant_type=authorization_code is supported',
        });
    }

    if (!code || !redirect_uri || !client_id || !code_verifier) {
        return res.status(400).json({
            error: 'invalid_request',
            error_description:
                'code, redirect_uri, client_id, and code_verifier are required',
        });
    }

    cleanupExpired();

    const stored = authCodes.get(code);
    if (!stored) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        });
    }

    // Not already used
    if (stored.used) {
        authCodes.delete(code);
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code has already been used',
        });
    }

    // Not expired
    if (stored.expiresAt <= Date.now()) {
        authCodes.delete(code);
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code has expired',
        });
    }

    if (stored.clientId !== client_id) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'client_id mismatch',
        });
    }

    if (stored.redirectUri !== redirect_uri) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'redirect_uri mismatch',
        });
    }

    // --- PKCE S256 verification ---
    const verifier = String(code_verifier).trim();
    const computedChallenge = computeS256Challenge(verifier);
    const storedChallenge = stored.codeChallenge;

    // TEMP debug logs
    console.log('[oauth/token] Stored challenge :', storedChallenge);
    console.log('[oauth/token] Computed challenge:', computedChallenge);
    console.log('[oauth/token] Verifier length   :', verifier.length);
    console.log('[oauth/token] Method            :', stored.codeChallengeMethod);

    const storedNorm = normalizeBase64Url(storedChallenge);
    const computedNorm = normalizeBase64Url(computedChallenge);

    if (stored.codeChallengeMethod !== 'S256' || storedNorm !== computedNorm) {
        console.log('[oauth/token] PKCE mismatch (normalized):', {
            storedNorm,
            computedNorm,
        });
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier (PKCE verification failed)',
        });
    }

    // Mark used only after successful PKCE
    stored.used = true;
    authCodes.delete(code);

    // Same JWT format as routes/auth.js login
    const accessToken = jwt.sign({ id: stored.userId }, JWT_SECRET, {
        expiresIn: '7d',
    });

    const response = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_IN,
    };

    if (stored.scope) {
        response.scope = stored.scope;
    }

    return res.json(response);
});

module.exports = router;

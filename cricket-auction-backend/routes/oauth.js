const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Support application/x-www-form-urlencoded (OAuth clients + login form) and JSON
router.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// In-memory authorization code store (single-use, short-lived)
// ---------------------------------------------------------------------------
const authCodes = new Map();
const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days (matches login JWT)

function cleanupExpiredCodes() {
    const now = Date.now();
    for (const [code, data] of authCodes.entries()) {
        if (data.expiresAt <= now || data.used) {
            authCodes.delete(code);
        }
    }
}

function generateAuthCode() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * PKCE S256 helper — used ONLY for token-endpoint verification.
 * Hashes verifier as ASCII; digests as base64url (no manual base64 transforms).
 */
function generateCodeChallenge(verifier) {
    return require('crypto')
        .createHash('sha256')
        .update(String(verifier), 'ascii') // force ASCII
        .digest('base64url');
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
 * Simple HTML login page for the authorization endpoint.
 * OAuth params are carried as hidden fields so they survive form submit.
 */
function renderLoginForm({
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
    error,
}) {
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
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}" />
      <input type="hidden" name="state" value="${escapeHtml(state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || 'S256')}" />
      <input type="hidden" name="scope" value="${escapeHtml(scope)}" />

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
 * Validate OAuth authorize params (shared by GET and POST).
 * Returns { ok: true, params } or { ok: false, status, body }.
 */
function validateAuthorizeParams(source) {
    const response_type = source.response_type;
    const client_id = source.client_id;
    const redirect_uri = source.redirect_uri;
    // Store code_challenge exactly as received (trimmed only)
    const code_challenge = source.code_challenge
        ? String(source.code_challenge).trim()
        : '';
    const code_challenge_method = String(
        source.code_challenge_method || 'S256'
    ).trim();
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
            code_challenge, // trimmed, as received from client
            code_challenge_method,
            state,
            scope,
        },
    };
}

/**
 * RFC 7591 Dynamic Client Registration (minimal stub).
 * Public — no authentication required.
 * Always returns client_id "cursor" for now (no real client store yet).
 *
 * Mounted at:
 *   POST /oauth/register
 *   POST /register  (root alias in server.js)
 */
function handleClientRegistration(req, res) {
    const body = req.body || {};
    const redirect_uris = Array.isArray(body.redirect_uris)
        ? body.redirect_uris
        : body.redirect_uri
          ? [body.redirect_uri]
          : [];

    // Always issue the same static client for now
    return res.status(201).json({
        client_id: 'cursor',
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: body.client_name || 'cursor',
        redirect_uris,
        grant_types: body.grant_types || ['authorization_code'],
        response_types: body.response_types || ['code'],
        token_endpoint_auth_method:
            body.token_endpoint_auth_method || 'none',
    });
}

router.post('/register', handleClientRegistration);

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * Mounted at:
 *   GET /.well-known/oauth-authorization-server  (via app.use('/', oauthRoutes))
 *
 * Endpoints advertised at root (/authorize, /token, /register) to match
 * the dual mount of this router at / and /oauth.
 */
const DEFAULT_OAUTH_ISSUER = 'https://cricket-auction-app-66aj.onrender.com';

function getOAuthIssuer() {
    const fromEnv = process.env.OAUTH_ISSUER || process.env.BASE_URL;
    if (fromEnv) {
        return String(fromEnv).replace(/\/$/, '');
    }
    return DEFAULT_OAUTH_ISSUER;
}

router.get('/.well-known/oauth-authorization-server', (req, res) => {
    const issuer = getOAuthIssuer();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
    });
});

/**
 * GET /oauth/authorize
 *
 * OAuth 2.1 Authorization Code + PKCE.
 * Shows an HTML login form. After successful login (POST), redirects with code.
 *
 * Query params:
 *   response_type, client_id, redirect_uri, state,
 *   code_challenge, code_challenge_method
 */
router.get('/authorize', (req, res) => {
    const result = validateAuthorizeParams(req.query);
    if (!result.ok) {
        return res.status(result.status).json(result.body);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLoginForm(result.params));
});

/**
 * POST /oauth/authorize
 *
 * Handles login form submit: verify email/password against users table
 * (same rules as /api/auth/login), then issue auth code and redirect.
 */
router.post('/authorize', async (req, res) => {
    const result = validateAuthorizeParams(req.body);
    if (!result.ok) {
        return res.status(result.status).json(result.body);
    }

    const params = result.params;
    const { email, password } = req.body;
    const pool = req.app.get('db');

    const sendFormError = (message) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(401).send(
            renderLoginForm({ ...params, error: message })
        );
    };

    if (!email || !password) {
        return sendFormError('Email and password are required');
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return sendFormError('Invalid email or password');
        }

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return sendFormError('Invalid email or password');
        }

        if (!user.email_verified) {
            return sendFormError(
                'Please verify your email before signing in. Check your inbox for a verification code.'
            );
        }

        cleanupExpiredCodes();

        // Store code_challenge exactly as received (trimmed only — no re-hash).
        const storedChallenge = String(params.code_challenge).trim();

        const code = generateAuthCode();
        authCodes.set(code, {
            userId: user.id,
            clientId: params.client_id,
            redirectUri: params.redirect_uri,
            codeChallenge: storedChallenge,
            codeChallengeMethod: String(params.code_challenge_method || 'S256').trim(),
            scope: params.scope,
            expiresAt: Date.now() + AUTH_CODE_TTL_MS,
            used: false,
        });

        console.log('[oauth/authorize] Stored challenge (from client):', storedChallenge);
        console.log('[oauth/authorize] Stored method:', String(params.code_challenge_method || 'S256').trim());

        const redirectUrl = new URL(params.redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (params.state) {
            redirectUrl.searchParams.set('state', params.state);
        }

        return res.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('OAuth authorize login error:', error);
        return sendFormError('Something went wrong. Please try again.');
    }
});

/**
 * POST /oauth/token
 *
 * Exchange an authorization code + code_verifier for an access token.
 * The access_token is a normal JWT accepted by existing APIs
 * (same shape as /api/auth/login: { id }, 7d expiry).
 *
 * Body (form or JSON):
 *   grant_type     must be "authorization_code"
 *   code           required
 *   redirect_uri   required (must match authorize)
 *   client_id      required (must match authorize)
 *   code_verifier  required (PKCE)
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

    cleanupExpiredCodes();

    // 1) Authorization code must exist, not be used, and not be expired
    const stored = authCodes.get(code);

    if (!stored) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        });
    }

    if (stored.used) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code has already been used',
        });
    }

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

    // 2) PKCE: hash code_verifier as-is (no trim/decode/replace), then compare
    const storedChallenge = String(stored.codeChallenge ?? '').trim();

    console.log('Verifier received :', JSON.stringify(code_verifier));
    console.log('Stored challenge  :', JSON.stringify(storedChallenge));
    console.log('Computed challenge:', JSON.stringify(generateCodeChallenge(code_verifier)));

    const computedChallenge = generateCodeChallenge(code_verifier);
    const pkceMatch =
        String(computedChallenge).trim() === String(storedChallenge).trim();

    if (!pkceMatch) {
        return res.status(400).json({
            error: 'invalid_grant',
            error_description:
                'PKCE verification failed: code_verifier does not match code_challenge',
        });
    }

    // 3) Only after successful PKCE: consume code and issue JWT
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
module.exports.handleClientRegistration = handleClientRegistration;

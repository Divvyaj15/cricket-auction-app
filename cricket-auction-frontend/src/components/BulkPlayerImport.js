// ============================================
// src/components/BulkPlayerImport.js
// ============================================
import React, { useState } from 'react';
import { playerAPI } from '../services/api';

const BulkPlayerImport = ({ tournamentId, onImportComplete }) => {
    const [showModal, setShowModal] = useState(false);
    const [importMethod, setImportMethod] = useState('manual'); // 'manual' or 'csv'
    const [textInput, setTextInput] = useState('');
    const [csvFile, setCSVFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState([]);

    const parseManualInput = (text) => {
        // Format: Name,Role,BasePrice (one per line)
        // Example: 
        // Virat Kohli,batsman,2.5
        // Jasprit Bumrah,bowler,3.0

        const lines = text.split('\n').filter(line => line.trim());
        const players = [];
        const parseErrors = [];

        lines.forEach((line, index) => {
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length !== 3) {
                parseErrors.push(`Line ${index + 1}: Invalid format. Expected: Name,Role,BasePrice`);
                return;
            }

            const [name, role, basePriceStr] = parts;
            const basePrice = parseFloat(basePriceStr) * 100000; // Convert to lakhs

            if (!name) {
                parseErrors.push(`Line ${index + 1}: Name is required`);
                return;
            }

            const validRoles = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'];
            if (!validRoles.includes(role.toLowerCase())) {
                parseErrors.push(`Line ${index + 1}: Invalid role. Must be: batsman, bowler, all-rounder, or wicket-keeper`);
                return;
            }

            if (isNaN(basePrice) || basePrice <= 0) {
                parseErrors.push(`Line ${index + 1}: Invalid base price`);
                return;
            }

            players.push({
                name,
                role: role.toLowerCase(),
                base_price: basePrice
            });
        });

        return { players, errors: parseErrors };
    };

    const parseCSV = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim());
                const players = [];
                const parseErrors = [];

                // Skip header row if it exists
                const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    const parts = line.split(',').map(p => p.trim());
                    
                    if (parts.length < 3) continue;

                    const [name, role, basePriceStr] = parts;
                    const basePrice = parseFloat(basePriceStr) * 100000;

                    if (!name || !role || isNaN(basePrice)) {
                        parseErrors.push(`Row ${i + 1}: Invalid data`);
                        continue;
                    }

                    players.push({
                        name,
                        role: role.toLowerCase(),
                        base_price: basePrice
                    });
                }

                resolve({ players, errors: parseErrors });
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    };

    const handleImport = async () => {
        setLoading(true);
        setErrors([]);

        try {
            let result;

            if (importMethod === 'manual') {
                result = parseManualInput(textInput);
            } else {
                if (!csvFile) {
                    setErrors(['Please select a CSV file']);
                    setLoading(false);
                    return;
                }
                result = await parseCSV(csvFile);
            }

            if (result.errors.length > 0) {
                setErrors(result.errors);
                setLoading(false);
                return;
            }

            if (result.players.length === 0) {
                setErrors(['No valid players found']);
                setLoading(false);
                return;
            }

            // Send to API
            const data = await playerAPI.bulkAdd(tournamentId, result.players);

            if (data.error) {
                setErrors([data.error]);
            } else {
                alert(`Successfully imported ${result.players.length} players!`);
                setShowModal(false);
                setTextInput('');
                setCSVFile(null);
                if (onImportComplete) onImportComplete();
            }
        } catch (error) {
            setErrors([error.message]);
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const csvContent = "Name,Role,BasePrice\nVirat Kohli,batsman,2.5\nJasprit Bumrah,bowler,3.0\nRavindra Jadeja,all-rounder,2.0\nMS Dhoni,wicket-keeper,2.5";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'players_template.csv';
        a.click();
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
                Bulk Import Players
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold mb-4">Bulk Import Players</h3>

                        {/* Import Method Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Import Method
                            </label>
                            <div className="flex space-x-4">
                                <button
                                    onClick={() => setImportMethod('manual')}
                                    className={`flex-1 py-2 px-4 rounded-lg border-2 ${
                                        importMethod === 'manual'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 text-gray-700'
                                    }`}
                                >
                                    Manual Entry
                                </button>
                                <button
                                    onClick={() => setImportMethod('csv')}
                                    className={`flex-1 py-2 px-4 rounded-lg border-2 ${
                                        importMethod === 'csv'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 text-gray-700'
                                    }`}
                                >
                                    CSV Upload
                                </button>
                            </div>
                        </div>

                        {/* Manual Entry */}
                        {importMethod === 'manual' && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter Players (One per line)
                                </label>
                                <div className="mb-2 p-3 bg-gray-100 rounded text-sm">
                                    <p className="font-semibold mb-1">Format: Name,Role,BasePrice</p>
                                    <p className="text-gray-600">Example:</p>
                                    <code className="text-xs">
                                        Virat Kohli,batsman,2.5<br/>
                                        Jasprit Bumrah,bowler,3.0<br/>
                                        Ravindra Jadeja,all-rounder,2.0
                                    </code>
                                    <p className="text-gray-600 mt-2 text-xs">
                                        Roles: batsman, bowler, all-rounder, wicket-keeper<br/>
                                        BasePrice is in Lakhs (₹)
                                    </p>
                                </div>
                                <textarea
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    rows="15"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                                    placeholder="Virat Kohli,batsman,2.5&#10;Jasprit Bumrah,bowler,3.0&#10;..."
                                />
                            </div>
                        )}

                        {/* CSV Upload */}
                        {importMethod === 'csv' && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload CSV File
                                </label>
                                <div className="mb-4">
                                    <button
                                        onClick={downloadTemplate}
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        📥 Download CSV Template
                                    </button>
                                </div>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => setCSVFile(e.target.files[0])}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label
                                        htmlFor="csv-upload"
                                        className="cursor-pointer text-blue-600 hover:text-blue-700"
                                    >
                                        {csvFile ? (
                                            <div>
                                                <p className="font-semibold">{csvFile.name}</p>
                                                <p className="text-sm text-gray-500">Click to change file</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-semibold">Click to select CSV file</p>
                                                <p className="text-sm text-gray-500">or drag and drop</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
                                    <p className="font-semibold mb-1">CSV Format:</p>
                                    <code className="text-xs">
                                        Name,Role,BasePrice<br/>
                                        Virat Kohli,batsman,2.5<br/>
                                        Jasprit Bumrah,bowler,3.0
                                    </code>
                                </div>
                            </div>
                        )}

                        {/* Errors */}
                        {errors.length > 0 && (
                            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded max-h-40 overflow-y-auto">
                                <p className="font-semibold mb-2">Errors:</p>
                                <ul className="list-disc list-inside text-sm">
                                    {errors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex space-x-4">
                            <button
                                onClick={handleImport}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                            >
                                {loading ? 'Importing…' : 'Import Players'}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={loading}
                                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-200 disabled:cursor-not-allowed font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BulkPlayerImport;
                            
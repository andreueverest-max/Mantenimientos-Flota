import React, { useState } from 'react';
import { db } from '../db';
import { Upload, CheckCircle, AlertTriangle, FileText, Trash2 } from 'lucide-react';

const Import = ({ user }) => {
    const isAdmin = user?.role === 'admin';
    const [data, setData] = useState(db.get());
    const [logs, setLogs] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [encoding, setEncoding] = useState('UTF-8');

    const addLog = (message, type = 'info') => {
        setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
    };

    const normalizeKey = (key) => {
        if (!key) return '';
        return key.toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""); // Removes accents
    };

    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) return [];

        const rawHeaders = lines[0].split(';').map(h => h.trim());
        const headers = rawHeaders.map(normalizeKey);

        return lines.slice(1).map(line => {
            const values = line.split(';').map(v => v.trim());
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = values[i];
            });
            return obj;
        });
    };

    const getAuxId = (table, value) => {
        if (!value) return '';
        const lowerValue = value.toLowerCase();
        const item = data[table].find(i => i.value.toLowerCase() === lowerValue);
        return item ? item.id : '';
    };


    // Refined handle functions
    const clearPlansAndHistory = () => {
        if (!isAdmin) {
            alert('Solo los administradores pueden realizar esta acción.');
            return;
        }
        if (confirm('¿Realmente deseas borrar TODOS los planes de mantenimiento y todo el historial? Esta acción no se puede deshacer.')) {
            const newData = { ...db.get() };
            newData.maintenancePlans = [];
            newData.history = [];
            db.save(newData);
            setData(newData);
            addLog('Planes e Histórico borrados correctamente.', 'success');
        }
    };

    const processFile = (file, type) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvData = parseCSV(event.target.result);
                const newData = { ...db.get() };
                let count = 0;
                let errors = 0;

                if (type === 'vehicles') {
                    csvData.forEach(row => {
                        const id = row['id']?.padStart(4, '0');
                        if (!id) { errors++; return; }
                        if (newData.vehicles.some(v => v.id === id)) return;
                        newData.vehicles.push({
                            id,
                            licensePlate: row['matricula'] || '',
                            brandId: getAuxId('brands', row['marca']),
                            modelId: getAuxId('models', row['modelo']),
                            vehicleTypeId: getAuxId('vehicleTypes', row['tipo vehiculo']),
                            systemId: getAuxId('systems', row['sistema']),
                            status: row['estado'] || 'Activo',
                            greaseType: row['engrase'] || 'Manual',
                            notes: row['notas'] || ''
                        });
                        count++;
                    });
                } else if (type === 'plans') {
                    csvData.forEach(row => {
                        const vehicleId = row['id vehiculo']?.padStart(4, '0');
                        const maintenanceTypeId = getAuxId('maintenanceTypes', row['tipo mantenimiento']);
                        if (!vehicleId || !maintenanceTypeId) { errors++; return; }

                        const nextId = (newData.maintenancePlans.length > 0
                            ? Math.max(...newData.maintenancePlans.map(i => parseInt(i.id))) + 1
                            : 1).toString();

                        newData.maintenancePlans.push({
                            id: nextId,
                            vehicleId,
                            maintenanceTypeId,
                            periodDays: parseInt(row['dias'] || 0),
                            periodKm: parseInt(row['km'] || 0),
                            oilTypeId: getAuxId('oilTypes', row['aceite']),
                            status: 'Activo'
                        });
                        count++;
                    });
                } else if (type === 'history') {
                    csvData.forEach(row => {
                        const vehicleId = row['id vehiculo']?.padStart(4, '0');
                        const maintenanceType = row['tipo mantenimiento'];
                        if (!vehicleId || !maintenanceType) { errors++; return; }

                        const mtId = getAuxId('maintenanceTypes', maintenanceType);
                        const plan = newData.maintenancePlans.find(p => p.vehicleId === vehicleId && p.maintenanceTypeId === mtId);

                        if (!plan) {
                            addLog(`Error: No se encontró plan de "${maintenanceType}" para vehículo ${vehicleId}`, 'error');
                            errors++;
                            return;
                        }

                        const nextId = (newData.history.length > 0
                            ? Math.max(...newData.history.map(i => parseInt(i.id))) + 1
                            : 1).toString();

                        let formattedDate = row['fecha'];
                        if (formattedDate && formattedDate.includes('/')) {
                            const [d, m, y] = formattedDate.split('/');
                            if (d && m && y) {
                                formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                            }
                        }

                        newData.history.push({
                            id: nextId,
                            planId: plan.id,
                            vehicleId,
                            date: formattedDate,
                            km: 0,
                            operatorId: getAuxId('operators', row['operario']),
                            notes: row['observaciones'] || ''
                        });
                        count++;
                    });
                }

                db.save(newData);
                setData(newData);
                addLog(`Importación de ${type} finalizada. ${count} registros añadidos, ${errors} errores.`, 'success');
            } catch (err) {
                addLog(`Error al procesar ${type}: ${err.message}`, 'error');
            }
            setIsImporting(false);
        };
        reader.readAsText(file, encoding);
    };

    return (
        <div className="import-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>Importación Masiva de Datos</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bc-grey-10)', padding: '8px 16px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>Codificación CSV:</span>
                    <select
                        value={encoding}
                        onChange={(e) => setEncoding(e.target.value)}
                        className="search-input"
                        style={{ width: '150px', margin: '0' }}
                    >
                        <option value="UTF-8">UTF-8 (Estándar)</option>
                        <option value="ISO-8859-1">Windows / Excel (Español)</option>
                    </select>
                </div>
                {isAdmin && (
                    <button
                        className="bc-button"
                        style={{ backgroundColor: 'var(--bc-warning)', color: 'black' }}
                        onClick={clearPlansAndHistory}
                    >
                        <Trash2 size={16} style={{ marginRight: '8px' }} />
                        Limpiar Planes e Histórico
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div className="bc-card">
                    <h3>1. Vehículos</h3>
                    <p style={{ fontSize: '12px', color: 'var(--bc-text-secondary)', margin: '8px 0 16px' }}>
                        Campos: ID; Matrícula; Marca; Modelo; Tipo Vehículo; Sistema; Estado; Engrase; Notas
                    </p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => { processFile(e.target.files[0], 'vehicles'); e.target.value = ''; }}
                        style={{ display: 'none' }}
                        id="import-vehicles"
                    />
                    <label htmlFor="import-vehicles" className="bc-button" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        Subir CSV Vehículos
                    </label>
                </div>

                <div className="bc-card">
                    <h3>2. Planes</h3>
                    <p style={{ fontSize: '12px', color: 'var(--bc-text-secondary)', margin: '8px 0 16px' }}>
                        Campos: ID Vehículo; Tipo Mantenimiento; Días; Km; Aceite
                    </p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => { processFile(e.target.files[0], 'plans'); e.target.value = ''; }}
                        style={{ display: 'none' }}
                        id="import-plans"
                    />
                    <label htmlFor="import-plans" className="bc-button" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        Subir CSV Planes
                    </label>
                </div>

                <div className="bc-card">
                    <h3>3. Histórico</h3>
                    <p style={{ fontSize: '12px', color: 'var(--bc-text-secondary)', margin: '8px 0 16px' }}>
                        Campos: Fecha; ID Vehículo; Tipo Mantenimiento; Operario; Observaciones
                    </p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => { processFile(e.target.files[0], 'history'); e.target.value = ''; }}
                        style={{ display: 'none' }}
                        id="import-history"
                    />
                    <label htmlFor="import-history" className="bc-button" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        Subir CSV Histórico
                    </label>
                </div>
            </div>

            <div className="bc-card">
                <h3>Registro de Actividad</h3>
                <div style={{
                    marginTop: '16px',
                    height: '300px',
                    overflowY: 'auto',
                    background: 'var(--bc-grey-10)',
                    padding: '16px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '13px'
                }}>
                    {logs.length === 0 && <p style={{ color: 'var(--bc-text-secondary)' }}>No hay actividad reciente.</p>}
                    {logs.map((log, i) => (
                        <div key={i} style={{
                            marginBottom: '4px',
                            color: log.type === 'error' ? 'var(--bc-error)' : log.type === 'success' ? 'var(--bc-success)' : log.type === 'warning' ? '#b8860b' : 'var(--bc-text)'
                        }}>
                            [{log.time}] {log.message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Import;

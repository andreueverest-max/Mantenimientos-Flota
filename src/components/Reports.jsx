import React, { useState } from 'react';
import { db } from '../db';
import { FileText, Printer, Download, Search } from 'lucide-react';

const Reports = () => {
    const [data] = useState(db.get());
    const [searchTerm, setSearchTerm] = useState('');
    const [groupBy, setGroupBy] = useState('none');

    // Helper to parse dates safely
    const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('-')) return new Date(dateStr);
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return new Date(`${y}-${m}-${d}`);
        }
        return new Date(dateStr);
    };

    // Helper to format dates to DD/MM/YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = parseSafeDate(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-ES');
    };

    const getAuxValue = (table, id) => {
        const item = data[table].find(i => i.id === id);
        return item ? item.value : 'N/A';
    };

    // Calculate report data
    const getReportData = () => {
        const report = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.maintenancePlans.forEach(plan => {
            if (plan.status !== 'Activo') return;

            const vehicle = data.vehicles.find(v => v.id === plan.vehicleId);
            if (!vehicle) return;

            const planHistory = data.history.filter(h => h.planId === plan.id);
            let lastDate = null;
            let daysOverdue = 0;
            let status = 'En Plazo';

            if (planHistory.length > 0) {
                const sortedHistory = [...planHistory].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
                lastDate = sortedHistory[0].date;
                const lastDateParsed = parseSafeDate(lastDate);

                const periodDays = parseInt(plan.periodDays) || 0;
                if (periodDays > 0) {
                    const dueDate = new Date(lastDateParsed);
                    dueDate.setDate(dueDate.getDate() + periodDays);

                    if (today > dueDate) {
                        const diffTime = Math.abs(today - dueDate);
                        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        status = 'Vencido';
                    }
                }
            } else {
                status = 'Pendiente'; // Never performed
            }

            report.push({
                vehicleId: vehicle.id,
                licensePlate: vehicle.licensePlate,
                system: getAuxValue('systems', vehicle.systemId),
                plan: getAuxValue('maintenanceTypes', plan.maintenanceTypeId),
                lastDate: lastDate,
                daysOverdue: daysOverdue,
                status: status
            });
        });

        // Filter by search
        const filtered = report.filter(r =>
            r.vehicleId.includes(searchTerm) ||
            r.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.system.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.plan.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort by daysOverdue descending
        return filtered.sort((a, b) => b.daysOverdue - a.daysOverdue);
    };

    const reportRows = getReportData();

    const handlePrint = () => {
        window.print();
    };

    const exportToExcel = () => {
        const headers = ['Vehículo', 'Matrícula', 'Sistema', 'Plan Mantenimiento', 'Últ. Realización', 'Días Vencidos', 'Estado'];

        let exportRows = [...reportRows];
        if (groupBy !== 'none') {
            exportRows.sort((a, b) => {
                const valA = (a[groupBy] || '').toLowerCase();
                const valB = (b[groupBy] || '').toLowerCase();
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return b.daysOverdue - a.daysOverdue;
            });
        }

        const rows = exportRows.map(r => [
            r.vehicleId,
            r.licensePlate,
            r.system,
            r.plan,
            formatDate(r.lastDate),
            r.daysOverdue,
            r.status
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Informe_Estado_Flota_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="reports-page">
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={28} color="var(--bc-blue)" />
                    <h2 style={{ margin: 0 }}>Informes de Flota</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="bc-button-secondary" onClick={exportToExcel}>
                        <Download size={16} style={{ marginRight: '8px' }} />
                        Excel
                    </button>
                    <button className="bc-button" onClick={handlePrint}>
                        <Printer size={16} style={{ marginRight: '8px' }} />
                        Imprimir / PDF
                    </button>
                </div>
            </div>

            <div className="bc-card no-print" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--bc-grey-130)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por vehículo, matrícula, sistema o plan..."
                        className="search-input"
                        style={{ width: '100%', paddingLeft: '40px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--bc-grey-130)', whiteSpace: 'nowrap' }}>Agrupar por:</span>
                    <select
                        className="bc-input"
                        style={{ width: 'auto', padding: '4px 12px' }}
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value)}
                    >
                        <option value="none">Sin agrupar</option>
                        <option value="system">Sistema</option>
                        <option value="licensePlate">Vehículo (Matrícula)</option>
                        <option value="plan">Plan de Mantenimiento</option>
                    </select>
                </div>
            </div>

            <div className="bc-card print-report" style={{ padding: '0', overflow: 'auto', maxHeight: 'calc(100vh - 250px)', border: '1px solid var(--bc-border)' }}>
                <div className="report-header" style={{ padding: '24px', borderBottom: '2px solid var(--bc-blue)', display: 'none' }}>
                    <h1 style={{ margin: 0, color: 'var(--bc-blue)' }}>Informe: Estado de Mantenimiento por Sistema</h1>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--bc-grey-130)' }}>Fecha de generación: {new Date().toLocaleString()}</p>
                </div>

                <style>
                    {`
                        @media print {
                            .no-print { display: none !important; }
                            .main-container, .app-content, .reports-page, .print-report { 
                                display: block !important; 
                                overflow: visible !important; 
                                height: auto !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .bc-card { 
                                box-shadow: none !important; 
                                border: 1px solid #eee !important;
                                overflow: visible !important;
                            }
                            .report-header { display: block !important; margin-bottom: 20px; }
                            body { background: white !important; font-size: 10pt !important; }
                            .app-shell { display: block !important; overflow: visible !important; }
                            .sidebar, .app-header { display: none !important; }
                            
                            .bc-table { 
                                width: 100% !important; 
                                font-size: 9pt !important; 
                                border-collapse: collapse !important;
                            }
                            .bc-table th { 
                                background-color: #f0f0f0 !important; 
                                color: black !important; 
                                border-bottom: 2px solid #000 !important;
                                padding: 6px 4px !important;
                                font-size: 9pt !important;
                            }
                            .bc-table td { 
                                padding: 4px 4px !important; 
                                border-bottom: 1px solid #ddd !important;
                                font-size: 8.5pt !important;
                            }
                            .vencido-text { color: red !important; font-weight: bold !important; }
                            .status-badge { border: 1px solid #ccc !important; padding: 1px 4px !important; }
                        }
                    `}
                </style>

                <table className="bc-table">
                    <thead>
                        <tr>
                            <th>Vehículo</th>
                            <th>Matrícula</th>
                            <th>Sistema</th>
                            <th>Plan de Mantenimiento</th>
                            <th>Últ. Realización</th>
                            <th style={{ textAlign: 'right' }}>Días Vencidos</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportRows.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--bc-grey-130)' }}>
                                    No hay datos que coincidan con los criterios.
                                </td>
                            </tr>
                        ) : groupBy === 'none' ? (
                            reportRows.map((r, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: '600' }}>{r.vehicleId}</td>
                                    <td>{r.licensePlate}</td>
                                    <td>{r.system}</td>
                                    <td>{r.plan}</td>
                                    <td>{formatDate(r.lastDate)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: r.daysOverdue > 0 ? '700' : 'normal', color: r.daysOverdue > 0 ? 'var(--bc-error)' : 'inherit' }} className={r.daysOverdue > 0 ? 'vencido-text' : ''}>
                                        {r.daysOverdue}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${r.status === 'Vencido' ? 'vencido' : (r.status === 'Pendiente' ? 'inactivo' : 'en-plazo')}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            // Render grouped items
                            Object.entries(
                                reportRows.reduce((acc, row) => {
                                    const key = row[groupBy] || 'Sin Categoría';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(row);
                                    return acc;
                                }, {})
                            ).map(([groupName, items], gIdx) => (
                                <React.Fragment key={gIdx}>
                                    <tr style={{ backgroundColor: 'var(--bc-grey-10)', fontWeight: 'bold', position: 'sticky', top: '45px', zIndex: 90 }}>
                                        <td colSpan="7" style={{ padding: '8px 12px', borderBottom: '1px solid var(--bc-grey-40)', boxShadow: 'inset 0 -1px 0 var(--bc-grey-40)', backgroundClip: 'padding-box', backgroundColor: 'var(--bc-grey-10)' }}>
                                            {groupBy === 'system' ? 'Sistema: ' : (groupBy === 'licensePlate' ? 'Vehículo: ' : (groupBy === 'plan' ? 'Plan: ' : ''))}{groupName} ({items.length})
                                        </td>
                                    </tr>
                                    {items.map((r, i) => (
                                        <tr key={`${gIdx}-${i}`}>
                                            <td style={{ fontWeight: '600', paddingLeft: '24px' }}>{r.vehicleId}</td>
                                            <td>{r.licensePlate}</td>
                                            <td>{r.system}</td>
                                            <td>{r.plan}</td>
                                            <td>{formatDate(r.lastDate)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: r.daysOverdue > 0 ? '700' : 'normal', color: r.daysOverdue > 0 ? 'var(--bc-error)' : 'inherit' }} className={r.daysOverdue > 0 ? 'vencido-text' : ''}>
                                                {r.daysOverdue}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${r.status === 'Vencido' ? 'vencido' : (r.status === 'Pendiente' ? 'inactivo' : 'en-plazo')}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                    {r.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Reports;

import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Search, Plus, Calendar, History, Save, Trash2, Edit2, Play, Pause } from 'lucide-react';

const Maintenance = () => {
    const [data, setData] = useState(db.get());

    // Helper to format dates to DD/MM/YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    // Helper to parse dates safely (handles YYYY-MM-DD and DD/MM/YYYY)
    const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('-')) {
            return new Date(dateStr);
        }
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return new Date(`${y}-${m}-${d}`);
        }
        return new Date(dateStr);
    };
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingHistory, setEditingHistory] = useState(null);

    const [planForm, setPlanForm] = useState({
        maintenanceTypeId: '',
        periodDays: '',
        periodKm: '',
        oilTypeId: ''
    });

    const [historyForm, setHistoryForm] = useState({
        date: new Date().toISOString().split('T')[0],
        operatorId: '',
        observations: ''
    });

    const getExpiryStatus = (plan) => {
        if (plan.status !== 'Activo') return { label: 'Pausado', class: 'inactivo' };

        const planHistory = data.history.filter(h => h.planId === plan.id);
        if (planHistory.length === 0) return { label: 'Pendiente', class: 'en-plazo' };

        // Get latest realization date
        const sortedHistory = [...planHistory].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
        const lastDate = parseSafeDate(sortedHistory[0].date);

        const days = parseInt(plan.periodDays) || 0;
        if (days === 0) return { label: 'Sin Periodo', class: 'en-plazo' };

        const dueDate = new Date(lastDate);
        dueDate.setDate(dueDate.getDate() + days);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today > dueDate) {
            return { label: 'Vencido', class: 'vencido' };
        }
        return { label: 'En Plazo', class: 'en-plazo' };
    };

    const filteredVehicles = data.vehicles.filter(v =>
        v.id.includes(searchTerm) || v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getAuxValue = (table, id) => {
        const item = data[table].find(i => i.id === id);
        return item ? item.value : 'N/A';
    };

    const handleVehicleSelect = (vehicle) => {
        setSelectedVehicle(vehicle);
        setSelectedPlan(null);
    };

    const handleSavePlan = (e) => {
        e.preventDefault();
        const newData = { ...db.get() };

        if (editingPlan) {
            newData.maintenancePlans = newData.maintenancePlans.map(p =>
                p.id === editingPlan.id ? { ...editingPlan, ...planForm } : p
            );
        } else {
            const nextId = (newData.maintenancePlans.length > 0
                ? Math.max(...newData.maintenancePlans.map(i => parseInt(i.id))) + 1
                : 1).toString();

            newData.maintenancePlans.push({
                ...planForm,
                id: nextId,
                vehicleId: selectedVehicle.id,
                status: 'Activo'
            });
        }

        db.save(newData);
        setData(newData);
        setIsPlanModalOpen(false);
        setPlanForm({ maintenanceTypeId: '', periodDays: '', periodKm: '', oilTypeId: '' });
        setEditingPlan(null);
    };

    const openEditPlan = (plan) => {
        setEditingPlan(plan);
        setPlanForm({
            maintenanceTypeId: plan.maintenanceTypeId,
            periodDays: plan.periodDays,
            periodKm: plan.periodKm,
            oilTypeId: plan.oilTypeId
        });
        setIsPlanModalOpen(true);
    };

    const handleSaveHistory = (e) => {
        e.preventDefault();
        const newData = { ...data };

        if (editingHistory) {
            newData.history = newData.history.map(h =>
                h.id === editingHistory.id ? { ...editingHistory, id: h.id, planId: h.planId } : h
            );
        } else {
            const nextId = (newData.history.length > 0
                ? Math.max(...newData.history.map(h => parseInt(h.id))) + 1
                : 1).toString();

            newData.history.push({
                id: nextId,
                planId: selectedPlan.id,
                ...historyForm
            });
        }

        db.save(newData);
        setData(newData);
        setIsHistoryModalOpen(false);
        setEditingHistory(null);
    };

    const deletePlan = (planId) => {
        const hasHistory = data.history.some(h => h.planId === planId);
        if (hasHistory) {
            alert('No se puede borrar el plan porque tiene registros históricos asociados.');
            return;
        }

        if (confirm('¿Deseas eliminar este plan de mantenimiento?')) {
            const newData = { ...data };
            newData.maintenancePlans = newData.maintenancePlans.filter(p => p.id !== planId);
            db.save(newData);
            setData(newData);
            setSelectedPlan(null);
        }
    };

    const openEditHistory = (history) => {
        setEditingHistory(history);
        setHistoryForm({ // Also update historyForm for consistency, though editingHistory will be used for date
            date: history.date,
            operatorId: history.operatorId,
            observations: history.observations
        });
        setIsHistoryModalOpen(true);
    };

    const togglePlanStatus = (planId) => {
        const newData = { ...data };
        let updatedPlan = null;
        newData.maintenancePlans = newData.maintenancePlans.map(p => {
            if (p.id === planId) {
                const newPlan = { ...p, status: p.status === 'Activo' ? 'Inactivo' : 'Activo' };
                updatedPlan = newPlan;
                return newPlan;
            }
            return p;
        });
        db.save(newData);
        setData(newData);

        // Update selected plan if it's the one we just toggled
        if (selectedPlan && selectedPlan.id === planId) {
            setSelectedPlan(updatedPlan);
        }
    };

    return (
        <div className="maintenance-page">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

                {/* Left: Vehicle Selection */}
                <div className="bc-card" style={{ padding: '0' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--bc-border)' }}>
                        <h3>Seleccionar Vehículo</h3>
                        <div style={{ position: 'relative', marginTop: '12px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--bc-grey-130)' }} />
                            <input
                                type="text"
                                placeholder="Nº o Matrícula..."
                                className="search-input"
                                style={{ width: '100%', paddingLeft: '34px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <table className="bc-table">
                            <tbody>
                                {filteredVehicles.map(v => (
                                    <tr
                                        key={v.id}
                                        onClick={() => handleVehicleSelect(v)}
                                        className={selectedVehicle?.id === v.id ? 'selected' : ''}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td style={{ fontWeight: '600' }}>{v.id}</td>
                                        <td>{v.licensePlate}</td>
                                        <td>{getAuxValue('brands', v.brandId)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Plans and History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {selectedVehicle ? (
                        <>
                            <div className="bc-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3>Planes de Mantenimiento: {selectedVehicle.id} ({selectedVehicle.licensePlate})</h3>
                                    <button className="bc-button" onClick={() => setIsPlanModalOpen(true)}>
                                        <Plus size={16} style={{ marginRight: '8px' }} />
                                        Nuevo Plan
                                    </button>
                                </div>
                                <table className="bc-table">
                                    <thead>
                                        <tr>
                                            <th>Mantenimiento</th>
                                            <th>Estado</th>
                                            <th>Plazo</th>
                                            <th>Periodo (Días/Km)</th>
                                            <th>Aceite</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.maintenancePlans.filter(p => p.vehicleId === selectedVehicle.id).map(p => (
                                            <tr
                                                key={p.id}
                                                onClick={() => setSelectedPlan(p)}
                                                className={`${selectedPlan?.id === p.id ? 'selected' : ''} ${p.status === 'Inactivo' ? 'inactive-row' : ''}`}
                                                style={{ cursor: 'pointer', opacity: p.status === 'Inactivo' ? 0.6 : 1 }}
                                            >
                                                <td>{getAuxValue('maintenanceTypes', p.maintenanceTypeId)}</td>
                                                <td>
                                                    <span className={`status-badge ${p.status?.toLowerCase().trim() === 'activo' ? 'activo' : 'inactivo'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const expiry = getExpiryStatus(p);
                                                        return (
                                                            <span className={`status-badge ${expiry.class}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                {expiry.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td>{p.periodDays}d / {p.periodKm}km</td>
                                                <td>{getAuxValue('oilTypes', p.oilTypeId)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); togglePlanStatus(p.id); }}
                                                            style={{ background: 'none', border: 'none', color: p.status === 'Activo' ? 'var(--bc-warning)' : 'var(--bc-success)' }}
                                                            title={p.status === 'Activo' ? 'Pausar Plan' : 'Activar Plan'}
                                                        >
                                                            {p.status === 'Activo' ? <Pause size={16} /> : <Play size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openEditPlan(p); }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--bc-blue)' }}
                                                            title="Editar Plan"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); deletePlan(p.id); }} style={{ background: 'none', border: 'none', color: 'var(--bc-error)' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedPlan && (
                                <div className="bc-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3>Histórico: {getAuxValue('maintenanceTypes', selectedPlan.maintenanceTypeId)}</h3>
                                        <button
                                            className="bc-button"
                                            onClick={() => { setIsHistoryModalOpen(true); setEditingHistory(null); setHistoryForm({ date: new Date().toISOString().split('T')[0], operatorId: '', observations: '' }); }}
                                            disabled={selectedPlan.status === 'Inactivo'}
                                            style={{
                                                opacity: selectedPlan.status === 'Inactivo' ? 0.5 : 1,
                                                cursor: selectedPlan.status === 'Inactivo' ? 'not-allowed' : 'pointer'
                                            }}
                                            title={selectedPlan.status === 'Inactivo' ? 'No se puede registrar mantenimiento en un plan inactivo' : ''}
                                        >
                                            <Save size={16} style={{ marginRight: '8px' }} />
                                            Registrar Realización
                                        </button>
                                    </div>
                                    <table className="bc-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Operario</th>
                                                <th>Observaciones</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.history.filter(h => h.planId === selectedPlan.id).sort((a, b) => new Date(b.date) - new Date(a.date)).map(h => (
                                                <tr key={h.id}>
                                                    <td>{formatDate(h.date)}</td>
                                                    <td>{getAuxValue('operators', h.operatorId)}</td>
                                                    <td>{h.observations}</td>
                                                    <td>
                                                        <button onClick={() => openEditHistory(h)} style={{ background: 'none', border: 'none', color: 'var(--bc-blue)' }}>
                                                            <Edit2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bc-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--bc-text-secondary)' }}>
                            Selecciona un vehículo para ver sus planes de mantenimiento
                        </div>
                    )}
                </div>
            </div>

            {/* Plan Modal */}
            {isPlanModalOpen && (
                <div className="modal-overlay">
                    <div className="bc-card modal-content" style={{ width: '400px' }}>
                        <h2>{editingPlan ? 'Editar Plan' : 'Nuevo Plan de Mantenimiento'}</h2>
                        <form onSubmit={handleSavePlan} style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label>Tipo de Mantenimiento</label>
                                <select
                                    value={planForm.maintenanceTypeId}
                                    onChange={(e) => setPlanForm({ ...planForm, maintenanceTypeId: e.target.value })}
                                    required
                                    disabled={!!editingPlan}
                                >
                                    <option value="">Seleccionar...</option>
                                    {data.maintenanceTypes.map(t => <option key={t.id} value={t.id}>{t.value}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Días entre mantenimientos</label>
                                <input
                                    type="number"
                                    value={planForm.periodDays}
                                    onChange={(e) => setPlanForm({ ...planForm, periodDays: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Kilómetros entre mantenimientos</label>
                                <input
                                    type="number"
                                    value={planForm.periodKm}
                                    onChange={(e) => setPlanForm({ ...planForm, periodKm: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipo de Aceite</label>
                                <select
                                    value={planForm.oilTypeId}
                                    onChange={(e) => setPlanForm({ ...planForm, oilTypeId: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {data.oilTypes.map(o => <option key={o.id} value={o.id}>{o.value}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="button" className="bc-button-secondary" onClick={() => { setIsPlanModalOpen(false); setEditingPlan(null); }}>Cancelar</button>
                                <button type="submit" className="bc-button">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="modal-overlay">
                    <div className="bc-card modal-content" style={{ width: '400px' }}>
                        <h2>{editingHistory ? 'Editar Realización' : 'Registrar Mantenimiento Realizado'}</h2>
                        <form onSubmit={handleSaveHistory} style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label>Fecha</label>
                                <input
                                    type="date"
                                    value={editingHistory ? editingHistory.date : historyForm.date}
                                    onChange={(e) => editingHistory ? setEditingHistory({ ...editingHistory, date: e.target.value }) : setHistoryForm({ ...historyForm, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Operario</label>
                                <select
                                    value={editingHistory ? editingHistory.operatorId : historyForm.operatorId}
                                    onChange={(e) => editingHistory ? setEditingHistory({ ...editingHistory, operatorId: e.target.value }) : setHistoryForm({ ...historyForm, operatorId: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccionar...</option>
                                    {data.operators.map(o => <option key={o.id} value={o.id}>{o.value}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Observaciones</label>
                                <textarea
                                    rows="3"
                                    value={historyForm.observations}
                                    onChange={(e) => setHistoryForm({ ...historyForm, observations: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid var(--bc-border)' }}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="button" className="bc-button-secondary" onClick={() => setIsHistoryModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="bc-button">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Maintenance;

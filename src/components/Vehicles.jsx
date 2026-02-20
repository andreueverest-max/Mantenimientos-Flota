import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';

const Vehicles = () => {
    const [data, setData] = useState(db.get());
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);

    const [formData, setFormData] = useState({
        id: '',
        licensePlate: '',
        brandId: '',
        modelId: '',
        vehicleTypeId: '',
        systemId: '',
        status: 'Activo',
        greaseType: 'Manual',
        notes: ''
    });

    const filteredVehicles = data.vehicles.filter(v =>
        v.id.includes(searchTerm) || v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getAuxValue = (table, id) => {
        const item = data[table].find(i => i.id === id);
        return item ? item.value : 'N/A';
    };

    const handleSave = (e) => {
        e.preventDefault();
        const newData = { ...data };

        // Format ID to 4 digits
        const formattedId = formData.id.padStart(4, '0');
        const vehicleToSave = { ...formData, id: formattedId };

        if (editingVehicle) {
            newData.vehicles = newData.vehicles.map(v => v.id === editingVehicle.id ? vehicleToSave : v);

            // Sync plan status if vehicle status changed
            if (editingVehicle.status !== vehicleToSave.status) {
                const planStatus = vehicleToSave.status === 'Activo' ? 'Activo' : 'Inactivo';
                newData.maintenancePlans = newData.maintenancePlans.map(p =>
                    p.vehicleId === vehicleToSave.id ? { ...p, status: planStatus } : p
                );
            }
        } else {
            if (newData.vehicles.some(v => v.id === formattedId)) {
                alert('El número de vehículo ya existe');
                return;
            }
            newData.vehicles.push(vehicleToSave);
        }

        db.save(newData);
        setData(newData);
        setIsModalOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            id: '',
            licensePlate: '',
            brandId: '',
            modelId: '',
            vehicleTypeId: '',
            systemId: '',
            status: 'Activo',
            greaseType: 'Manual',
            notes: ''
        });
        setEditingVehicle(null);
    };

    const openEdit = (vehicle) => {
        setEditingVehicle(vehicle);
        setFormData(vehicle);
        setIsModalOpen(true);
    };

    const deleteVehicle = (id) => {
        const hasPlans = data.maintenancePlans.some(p => p.vehicleId === id);
        if (hasPlans) {
            alert('No se puede borrar el vehículo porque tiene planes de mantenimiento asociados. Elimina los planes primero.');
            return;
        }

        if (confirm('¿Realmente deseas eliminar este vehículo?')) {
            const newData = { ...data };
            newData.vehicles = newData.vehicles.filter(v => v.id !== id);
            db.save(newData);
            setData(newData);
        }
    };

    return (
        <div className="vehicles-page">
            <div className="actions-bar">
                <button className="bc-button" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus size={16} style={{ marginRight: '8px' }} />
                    Nuevo Vehículo
                </button>
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--bc-grey-130)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por Nº o Matrícula..."
                        className="search-input"
                        style={{ paddingLeft: '34px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bc-card" style={{ padding: '0', marginTop: '24px', overflow: 'auto', maxHeight: 'calc(100vh - 220px)', border: '1px solid var(--bc-border)' }}>
                <table className="bc-table">
                    <thead>
                        <tr className="sticky-header">
                            <th>Nº</th>
                            <th>Matrícula</th>
                            <th>Marca</th>
                            <th>Modelo</th>
                            <th>Tipo</th>
                            <th>Sistema</th>
                            <th>Estado</th>
                            <th>Engrase</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVehicles.map(v => (
                            <tr key={v.id}>
                                <td style={{ fontWeight: '600' }}>{v.id}</td>
                                <td>{v.licensePlate}</td>
                                <td>{getAuxValue('brands', v.brandId)}</td>
                                <td>{getAuxValue('models', v.modelId)}</td>
                                <td>{getAuxValue('vehicleTypes', v.vehicleTypeId)}</td>
                                <td>{getAuxValue('systems', v.systemId)}</td>
                                <td>
                                    <span className={`status-badge ${v.status?.toLowerCase().trim() === 'activo' ? 'activo' : 'baja'}`}>
                                        {v.status}
                                    </span>
                                </td>
                                <td>{v.greaseType}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => openEdit(v)} style={{ background: 'none', border: 'none', color: 'var(--bc-blue)' }} title="Editar">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => deleteVehicle(v.id)} style={{ background: 'none', border: 'none', color: 'var(--bc-error)' }} title="Eliminar">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="bc-card modal-content" style={{ width: '500px' }}>
                        <h2>{editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
                        <form onSubmit={handleSave} style={{ marginTop: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>Nº Vehículo (4 dígitos)</label>
                                    <input
                                        type="text"
                                        maxLength="4"
                                        value={formData.id}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value.replace(/\D/g, '') })}
                                        disabled={editingVehicle}
                                        required
                                        style={{
                                            borderColor: !editingVehicle && formData.id && data.vehicles.some(v => v.id === formData.id.padStart(4, '0')) ? 'var(--bc-error)' : 'var(--bc-border)'
                                        }}
                                    />
                                    {!editingVehicle && formData.id && data.vehicles.some(v => v.id === formData.id.padStart(4, '0')) && (
                                        <p style={{ color: 'var(--bc-error)', fontSize: '12px', marginTop: '4px' }}>
                                            Este número ya existe: {formData.id.padStart(4, '0')}
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Matrícula</label>
                                    <input
                                        type="text"
                                        value={formData.licensePlate}
                                        onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Marca</label>
                                    <select
                                        value={formData.brandId}
                                        onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {data.brands.map(b => <option key={b.id} value={b.id}>{b.value}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Modelo</label>
                                    <select
                                        value={formData.modelId}
                                        onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {data.models.map(m => <option key={m.id} value={m.id}>{m.value}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tipo de Vehículo</label>
                                    <select
                                        value={formData.vehicleTypeId}
                                        onChange={(e) => setFormData({ ...formData, vehicleTypeId: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecciona tipo...</option>
                                        {data.vehicleTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.value}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Sistema</label>
                                    <select
                                        value={formData.systemId}
                                        onChange={(e) => setFormData({ ...formData, systemId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {data.systems.map(s => <option key={s.id} value={s.id}>{s.value}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tipo de Engrase</label>
                                    <select
                                        value={formData.greaseType}
                                        onChange={(e) => setFormData({ ...formData, greaseType: e.target.value })}
                                    >
                                        <option value="Manual">Manual</option>
                                        <option value="Automático">Automático</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notas</label>
                                <textarea
                                    rows="3"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid var(--bc-border)' }}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button type="button" className="bc-button-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="bc-button">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Vehicles;

import React, { useState } from 'react';
import { db, generateReportText, generateReportHTML } from '../db';
import { Plus, Trash2, Pencil, RefreshCcw, Eraser, Mail } from 'lucide-react';

const Auxiliary = ({ user }) => {
    const isAdmin = user?.role === 'admin';
    const [data, setData] = useState(db.get());
    const [activeTab, setActiveTab] = useState('brands');
    const [newValue, setNewValue] = useState('');

    const tables = [
        { id: 'brands', label: 'Marcas' },
        { id: 'models', label: 'Modelos' },
        { id: 'vehicleTypes', label: 'Tipos de Vehículo' },
        { id: 'systems', label: 'Sistemas' },
        { id: 'maintenanceTypes', label: 'Tipos de Mantenimiento' },
        { id: 'oilTypes', label: 'Tipos de Aceite' },
        { id: 'operators', label: 'Operarios' },
        { id: 'coordinators', label: 'Coordinadores' },
        { id: 'users', label: 'Usuarios' },
        { id: 'automation', label: 'Automatización' },
    ];

    const handleLoadDefaults = () => {
        const initialData = db.getInitial();
        const defaultValues = initialData[activeTab];

        if (confirm(`¿Reemplazar los valores de ${tables.find(t => t.id === activeTab).label} por los de fábrica? Mantendremos tus datos maestros.`)) {
            const newData = { ...data };
            newData[activeTab] = [...defaultValues];
            db.save(newData);
            setData(newData);
        }
    };

    const handleGlobalClear = () => {
        if (confirm('¿ESTÁS SEGURO? Esta acción BORRARÁ TODO (Vehículos, Planes, Histórico y Auxiliares). Solo se mantendrá el usuario administrador. Esta acción NO se puede deshacer.')) {
            if (confirm('Confirma por segunda vez: ¿Realmente deseas vaciar TODA la base de datos?')) {
                const blankData = db.clear();
                setData(blankData);
                window.location.reload(); // Reload to refresh all components state
            }
        }
    };

    const handleAdd = (e) => {
        e.preventDefault();
        const trimmedValue = newValue.trim();
        if (!trimmedValue) return;

        // Duplicate check (case-insensitive)
        const isDuplicate = data[activeTab].some(
            item => item.value.toLowerCase() === trimmedValue.toLowerCase()
        );

        if (isDuplicate) {
            alert(`El valor "${trimmedValue}" ya existe en esta tabla.`);
            return;
        }

        const newData = { ...data };
        const nextId = (newData[activeTab].length > 0
            ? Math.max(...newData[activeTab].map(i => parseInt(i.id))) + 1
            : 1).toString();

        newData[activeTab].push({ id: nextId, value: trimmedValue });
        db.save(newData);
        setData(newData);
        setNewValue('');
    };

    const handleDelete = (id) => {
        let isInUse = false;
        let diagnosticMessage = '';

        if (activeTab === 'brands') {
            isInUse = data.vehicles.some(v => v.brandId === id);
            diagnosticMessage = 'Hay vehículos registrados con esta marca.';
        } else if (activeTab === 'models') {
            isInUse = data.vehicles.some(v => v.modelId === id);
            diagnosticMessage = 'Hay vehículos registrados con este modelo.';
        } else if (activeTab === 'vehicleTypes') {
            isInUse = data.vehicles.some(v => v.vehicleTypeId === id);
            diagnosticMessage = 'Hay vehículos registrados con este tipo.';
        } else if (activeTab === 'systems') {
            isInUse = data.vehicles.some(v => v.systemId === id);
            diagnosticMessage = 'Hay vehículos asignados a este sistema.';
        } else if (activeTab === 'maintenanceTypes') {
            isInUse = data.maintenancePlans.some(p => p.maintenanceTypeId === id);
            diagnosticMessage = 'Hay planes de mantenimiento con este tipo.';
        } else if (activeTab === 'oilTypes') {
            isInUse = data.maintenancePlans.some(p => p.oilTypeId === id);
            diagnosticMessage = 'Hay planes que utilizan este tipo de aceite.';
        } else if (activeTab === 'operators') {
            isInUse = data.history.some(h => h.operatorId === id);
            diagnosticMessage = 'Este operario tiene registros históricos de mantenimiento.';
        }

        if (isInUse) {
            alert(`No se puede borrar: ${diagnosticMessage}`);
            return;
        }

        if (confirm('¿Deseas eliminar este registro de la tabla auxiliar?')) {
            const newData = { ...data };
            newData[activeTab] = newData[activeTab].filter(i => i.id !== id);
            db.save(newData);
            setData(newData);
        }
    };

    const handleUpdateSettings = (key, value) => {
        if (!isAdmin) {
            alert('No tienes permisos para modificar la configuración técnica.');
            return;
        }
        const newData = { ...data };
        const val = key === 'googleScriptUrl' ? value.trim() : value;
        newData.reportSettings = { ...newData.reportSettings, [key]: val };
        db.save(newData);
        setData(newData);
    };

    const [newCoordinator, setNewCoordinator] = useState({ name: '', role: '', email: '', systemId: '' });
    const [editingCoordinator, setEditingCoordinator] = useState(null);

    const handleAddCoordinator = (e) => {
        e.preventDefault();
        if (editingCoordinator) {
            const updatedCoordinators = data.coordinators.map(c =>
                c.id === editingCoordinator.id ? { ...newCoordinator, id: editingCoordinator.id } : c
            );
            const newData = { ...data, coordinators: updatedCoordinators };
            setData(newData);
            db.save(newData);
            setEditingCoordinator(null);
            setNewCoordinator({ name: '', role: '', email: '', systemId: '' });
        } else {
            const id = Date.now().toString(); // Use timestamp for unique ID
            const newData = { ...data, coordinators: [...data.coordinators, { ...newCoordinator, id }] };
            setData(newData);
            db.save(newData);
            setNewCoordinator({ name: '', role: '', email: '', systemId: '' });
        }
    };

    const handleEditCoordinator = (coordinator) => {
        setEditingCoordinator(coordinator);
        setNewCoordinator(coordinator);
    };

    const handleCancelEdit = () => {
        setEditingCoordinator(null);
        setNewCoordinator({ name: '', role: '', email: '', systemId: '' });
    };

    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' });
    const [editingUser, setEditingUser] = useState(null);

    const handleAddUser = (e) => {
        e.preventDefault();
        if (editingUser) {
            const updatedUsers = data.users.map(u =>
                u.username === editingUser.username ? { ...newUser } : u
            );
            const newData = { ...data, users: updatedUsers };
            setData(newData);
            db.save(newData);
            setEditingUser(null);
            setNewUser({ username: '', password: '', role: 'admin' });
        } else {
            if (data.users.some(u => u.username === newUser.username)) {
                alert('El nombre de usuario ya existe');
                return;
            }
            const newData = { ...data, users: [...data.users, newUser] };
            setData(newData);
            db.save(newData);
            setNewUser({ username: '', password: '', role: 'admin' });
        }
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setNewUser(user);
    };

    const handleCancelUserEdit = () => {
        setEditingUser(null);
        setNewUser({ username: '', password: '', role: 'admin' });
    };

    const handleDeleteUser = (username) => {
        if (data.users.length <= 1) {
            alert('No se puede eliminar el último usuario del sistema.');
            return;
        }
        if (confirm(`¿Realmente deseas eliminar al usuario "${username}"?`)) {
            const newData = { ...data, users: data.users.filter(u => u.username !== username) };
            setData(newData);
            db.save(newData);
        }
    };

    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            // First push local data
            await db.syncPush();
            // Then pull latest cloud data
            const result = await db.syncFetch();
            if (result.success) {
                setData(result.data);
                alert('Sincronización completada con éxito. Los datos están al día.');
            } else {
                alert('Datos locales enviados a la nube. (Nota: La nube aún no contiene datos previos para descargar, lo cual es normal la primera vez).');
            }
        } catch (err) {
            alert('Error en la sincronización: ' + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="auxiliary-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>Configuración de Tablas Auxiliares</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {data.reportSettings?.googleScriptUrl && (
                        <button
                            className="bc-button"
                            style={{ backgroundColor: 'var(--bc-blue)', color: 'white', opacity: isAdmin ? 1 : 0.6 }}
                            onClick={handleSyncNow}
                            disabled={isSyncing || !isAdmin}
                            title={!isAdmin ? 'Solo los administradores pueden sincronizar manualmente' : ''}
                        >
                            <RefreshCcw size={16} style={{ marginRight: '8px' }} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            className="bc-button"
                            style={{ backgroundColor: 'var(--bc-error)', color: 'white' }}
                            onClick={handleGlobalClear}
                        >
                            <Eraser size={16} style={{ marginRight: '8px' }} />
                            VACIAR TODA LA APP (Reset)
                        </button>
                    )}
                </div>
            </div>

            <div className="tabs-bar" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--bc-border)', paddingBottom: '0' }}>
                {tables.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={{
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === t.id ? '2px solid var(--bc-blue)' : '2px solid transparent',
                            color: activeTab === t.id ? 'var(--bc-blue)' : 'var(--bc-text-secondary)',
                            fontWeight: activeTab === t.id ? '600' : 'normal',
                            cursor: 'pointer'
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'coordinators' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div className="bc-card" style={{ marginBottom: '24px' }}>
                        <h3>{editingCoordinator ? 'Editar Coordinador' : 'Añadir Coordinador'}</h3>
                        <form onSubmit={handleAddCoordinator} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div className="form-group">
                                <label>Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={newCoordinator.name}
                                    onChange={(e) => setNewCoordinator({ ...newCoordinator, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Cargo</label>
                                <input
                                    type="text"
                                    value={newCoordinator.role || ''}
                                    onChange={(e) => setNewCoordinator({ ...newCoordinator, role: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={newCoordinator.email}
                                    onChange={(e) => setNewCoordinator({ ...newCoordinator, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Sistema / Responsabilidad</label>
                                <select
                                    value={newCoordinator.systemId}
                                    onChange={(e) => setNewCoordinator({ ...newCoordinator, systemId: e.target.value })}
                                >
                                    <option value="">TODOS / RESP. TRÁFICO</option>
                                    {data.systems.map(s => (
                                        <option key={s.id} value={s.id}>{s.value}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="submit" className="bc-button">
                                    <Plus size={16} style={{ marginRight: '8px' }} />
                                    {editingCoordinator ? 'Actualizar' : 'Añadir'}
                                </button>
                                {editingCoordinator && (
                                    <button type="button" className="bc-button-secondary" onClick={handleCancelEdit}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                    <div className="bc-card" style={{ padding: 0 }}>
                        <table className="bc-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Cargo</th>
                                    <th>Email</th>
                                    <th>Sistema</th>
                                    <th style={{ width: '130px' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.coordinators.map(c => (
                                    <tr key={c.id}>
                                        <td>{c.name}</td>
                                        <td>{c.role || '-'}</td>
                                        <td>{c.email}</td>
                                        <td>{c.systemId ? data.systems.find(s => s.id === c.systemId)?.value : 'TODOS / RESP. TRÁFICO'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => handleEditCoordinator(c)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--bc-blue)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const { reportSettings } = data;
                                                        const payload = {
                                                            to_email: c.email,
                                                            to_name: c.name,
                                                            subject: `Informe de Mantenimiento - ${new Date().toLocaleDateString()}`,
                                                            message: generateReportHTML(c.systemId),
                                                            is_html: 'true'
                                                        };

                                                        if (reportSettings.googleScriptUrl) {
                                                            try {
                                                                const params = new URLSearchParams();
                                                                params.append('to_email', payload.to_email);
                                                                params.append('to_name', payload.to_name);
                                                                params.append('subject', payload.subject);
                                                                params.append('message', payload.message);
                                                                params.append('is_html', 'true');

                                                                await fetch(reportSettings.googleScriptUrl, {
                                                                    method: 'POST',
                                                                    mode: 'no-cors', // Needed for Google Scripts
                                                                    headers: {
                                                                        'Accept': 'application/json'
                                                                    },
                                                                    body: params
                                                                });
                                                                alert('Solicitud de envío enviada a Google');
                                                            } catch (e) { alert('Error de conexión con Google'); }
                                                        } else {
                                                            alert('Configura la URL de Google Script en la pestaña de Automatización.');
                                                        }
                                                    }}
                                                    title="Enviar Informe Automático"
                                                    style={{ background: 'none', border: 'none', color: 'var(--bc-blue)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                >
                                                    <Mail size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'var(--bc-error)' }} title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'users' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div className="bc-card" style={{ marginBottom: '24px' }}>
                        <h3>{editingUser ? 'Editar Usuario' : 'Añadir Usuario'}</h3>
                        <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div className="form-group">
                                <label>Usuario</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    disabled={!!editingUser}
                                />
                            </div>
                            <div className="form-group">
                                <label>Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Rol</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="admin">Administrador</option>
                                    <option value="user">Usuario</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="submit" className="bc-button">
                                    <Plus size={16} style={{ marginRight: '8px' }} />
                                    {editingUser ? 'Actualizar' : 'Añadir'}
                                </button>
                                {editingUser && (
                                    <button type="button" className="bc-button-secondary" onClick={handleCancelUserEdit}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                    <div className="bc-card" style={{ padding: 0 }}>
                        <table className="bc-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th style={{ width: '100px' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.users.map(u => (
                                    <tr key={u.username}>
                                        <td>{u.username}</td>
                                        <td>{u.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--bc-blue)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteUser(u.username)} style={{ background: 'none', border: 'none', color: 'var(--bc-error)' }} title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'automation' ? (
                <div className="bc-card" style={{ maxWidth: '600px' }}>
                    <h3>Configuración de Envío Automático</h3>
                    <p style={{ color: 'var(--bc-grey-130)', fontSize: '14px', marginBottom: '24px' }}>
                        Define el momento en que se generará el aviso de envío de informes.
                        Los informes se enviarán a los coordinadores según su sistema asignado.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', opacity: isAdmin ? 1 : 0.7 }}>
                        <div className="form-group">
                            <label>Día de la Semana</label>
                            <select
                                value={data.reportSettings.dayOfWeek}
                                onChange={(e) => handleUpdateSettings('dayOfWeek', e.target.value)}
                                disabled={!isAdmin}
                            >
                                <option value="Monday">Lunes</option>
                                <option value="Tuesday">Martes</option>
                                <option value="Wednesday">Miércoles</option>
                                <option value="Thursday">Jueves</option>
                                <option value="Friday">Viernes</option>
                                <option value="Saturday">Sábado</option>
                                <option value="Sunday">Domingo</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Hora de Envío</label>
                            <input
                                type="time"
                                value={data.reportSettings.hour}
                                onChange={(e) => handleUpdateSettings('hour', e.target.value)}
                                disabled={!isAdmin}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', borderTop: '1px solid var(--bc-border)', paddingTop: '24px', opacity: isAdmin ? 1 : 0.7 }}>
                        <div className="form-group">
                            <label style={{ color: 'var(--bc-blue)' }}>Google Script URL (Directo Gmail/Drive)</label>
                            <input
                                type="password"
                                placeholder="https://script.google.com/macros/s/.../exec"
                                value={data.reportSettings.googleScriptUrl || ''}
                                onChange={(e) => handleUpdateSettings('googleScriptUrl', e.target.value)}
                                disabled={!isAdmin}
                            />
                            {!isAdmin && <p style={{ fontSize: '11px', color: 'var(--bc-error)', marginTop: '4px' }}>Sólo lectura para usuarios. Contacte con el administrador.</p>}
                            <p style={{ fontSize: '11px', color: 'var(--bc-grey-130)', marginTop: '8px' }}>
                                Esta URL conecta la aplicación directamente con tu Google Drive y Gmail.
                            </p>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', opacity: isAdmin ? 1 : 0.7 }}>
                        <input
                            type="checkbox"
                            id="automation-enabled"
                            checked={data.reportSettings.enabled}
                            onChange={(e) => handleUpdateSettings('enabled', e.target.checked)}
                            style={{ width: '20px', height: '20px' }}
                            disabled={!isAdmin}
                        />
                        <label htmlFor="automation-enabled" style={{ fontWeight: '600', cursor: 'pointer' }}>
                            Habilitar avisos de envío automático
                        </label>
                    </div>

                    {data.reportSettings.lastSent && (
                        <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--bc-grey-130)' }}>
                            Último envío realizado: {new Date(data.reportSettings.lastSent).toLocaleString()}
                        </p>
                    )}
                </div>
            ) : (
                <div className="bc-card" style={{ maxWidth: '600px' }}>
                    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <input
                            type="text"
                            placeholder={`Nuevo valor para ${tables.find(t => t.id === activeTab).label}...`}
                            className="search-input"
                            style={{ flex: 1 }}
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            required
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="bc-button" style={{ backgroundColor: 'var(--bc-grey-10)', color: 'var(--bc-text)' }} onClick={handleLoadDefaults}>
                                <RefreshCcw size={16} style={{ marginRight: '8px' }} />
                                Cargar de Fábrica
                            </button>
                            <button type="submit" className="bc-button">
                                <Plus size={16} style={{ marginRight: '8px' }} />
                                Añadir
                            </button>
                        </div>
                    </form>

                    <table className="bc-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Valor</th>
                                <th style={{ width: '80px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data[activeTab].map(item => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.value}</td>
                                    <td>
                                        <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--bc-error)' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Auxiliary;

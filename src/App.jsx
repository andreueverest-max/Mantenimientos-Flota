import React, { useState, useEffect } from 'react';
import { db, generateReportText, generateReportHTML } from './db';
import {
  LayoutDashboard,
  Truck,
  ClipboardList,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  Database,
  FileText,
  Mail,
  AlertCircle
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Vehicles from './components/Vehicles';
import Maintenance from './components/Maintenance';
import Auxiliary from './components/Auxiliary';
import Import from './components/Import';
import Reports from './components/Reports';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <div
    className={`sidebar-item ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <Icon size={20} />
    <span>{label}</span>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showAutoReportModal, setShowAutoReportModal] = useState(false);
  const [pendingCoordinators, setPendingCoordinators] = useState([]);
  const [sendingStatus, setSendingStatus] = useState({}); // { id: 'sending' | 'success' | 'error' }

  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [showLinkDevice, setShowLinkDevice] = useState(false);
  const [tempScriptUrl, setTempScriptUrl] = useState('');

  // Initial Sync and Polling
  useEffect(() => {
    const fetchSync = async (silent = false) => {
      if (!silent) setIsSyncing(true);
      const result = await db.syncFetch(silent);
      if (result.success) {
        setLastUpdated(Date.now());
      }
      if (!silent) setInitialSyncDone(true);
      if (!silent) setIsSyncing(false);
    };

    fetchSync(); // Initial load (visible)

    const interval = setInterval(() => {
      fetchSync(true); // Background polling (silent) every 5 minutes
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLinkDevice = async (e) => {
    e.preventDefault();
    if (!tempScriptUrl) return;

    setIsSyncing(true);

    // 1. First, we just store the URL locally without triggering a cloud save
    const localData = db.get();
    localData.reportSettings = { ...localData.reportSettings, googleScriptUrl: tempScriptUrl.trim() };
    localStorage.setItem('mantenimientos_db', JSON.stringify(localData));

    // 2. Now force a sync from the cloud to overwrite local blank data with shared data
    const result = await db.syncFetch();

    setIsSyncing(false);

    if (result.success && result.data && result.data.users && result.data.users.length > 0) {
      setShowLinkDevice(false);
      setLastUpdated(Date.now());
      alert('¡Éxito! Dispositivo vinculado y datos importados correctamente.');
    } else {
      let msg = 'No se han podido descargar datos de la nube.';

      if (result.error === 'PERMISOS_SCRIPTS') {
        msg = 'ERROR DE PERMISOS: El Google Script devolvió una página de acceso en lugar de datos.\n\nRevisa en tu Google Script:\n1. Pulsa "Implementar" > "Gestionar implementaciones".\n2. Edita la implementación actual (icono lápiz).\n3. Cambia "Quién tiene acceso" a "Cualquier persona" (Anyone).\n4. Vuelve a copiar la URL y pégala aquí.';
      } else if (result.error === 'NUBE_VACIA') {
        msg = 'LA NUBE ESTÁ VACÍA: La conexión funciona, pero no hay datos guardados.\n\nVe al TERMINAL ORIGINAL y pulsa "Sincronizar Ahora" en Configuración > Automatización.';
      } else if (result.error === 'ERROR_CONEXION') {
        msg = `ERROR DE CONEXIÓN: No se pudo contactar con el script. Revisa tu conexión a internet y que la URL sea correcta.\n\nDetalle técnico: ${result.details || 'Error desconocido'}`;
      }

      alert(msg);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { users } = db.get();
    const foundUser = users.find(u => u.username === loginData.username && u.password === loginData.password);
    if (foundUser) {
      setUser(foundUser);
      setError('');
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  useEffect(() => {
    if (user) {
      const checkSchedule = () => {
        const data = db.get();
        const { reportSettings, coordinators } = data;
        if (!reportSettings || !reportSettings.enabled) return;

        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const todayStr = now.toISOString().split('T')[0];

        if (currentDay === reportSettings.dayOfWeek && currentTime >= reportSettings.hour) {
          if (reportSettings.lastSent !== todayStr) {
            setPendingCoordinators(coordinators);
            setShowAutoReportModal(true);
          }
        }
      };

      const interval = setInterval(checkSchedule, 60000);
      checkSchedule();
      return () => clearInterval(interval);
    }
  }, [user, lastUpdated]);

  const handleFinishAutoSend = () => {
    const data = db.get();
    data.reportSettings.lastSent = new Date().toISOString().split('T')[0];
    db.save(data);
    setShowAutoReportModal(false);
  };

  const sendAllEmails = async () => {
    const { reportSettings } = db.get();

    if (!reportSettings.googleScriptUrl) {
      alert('Por favor, configura la URL de Google Script en la pestaña de Configuración > Automatización.');
      return;
    }

    const newStatus = { ...sendingStatus };
    for (const coordinator of pendingCoordinators) {
      newStatus[coordinator.id] = 'sending';
      setSendingStatus({ ...newStatus });

      const payload = {
        to_name: coordinator.name,
        to_email: coordinator.email,
        subject: `Aviso: Mantenimientos de Flota - ${new Date().toLocaleDateString()}`,
        message: generateReportHTML(coordinator.systemId)
      };

      try {
        const params = new URLSearchParams();
        params.append('to_email', payload.to_email);
        params.append('to_name', payload.to_name);
        params.append('subject', payload.subject);
        params.append('message', payload.message);
        params.append('is_html', 'true');

        await fetch(reportSettings.googleScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: params
        });
        newStatus[coordinator.id] = 'success';
      } catch (err) {
        newStatus[coordinator.id] = 'error';
      }
      setSendingStatus({ ...newStatus });
    }
  };

  if (!initialSyncDone || isSyncing) {
    return (
      <div className="login-container">
        <div className="bc-card login-card" style={{ textAlign: 'center' }}>
          <div className="sync-spinner" style={{ marginBottom: '20px' }}>
            <Database size={48} color="var(--bc-blue)" className="animate-spin" />
          </div>
          <h2>Sincronizando...</h2>
          <p>Conectando con Google Drive para actualizar datos.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="bc-card login-card">
          <div className="login-logo">
            <Truck size={48} color="var(--bc-blue)" />
            <h1>Gestion de Flota</h1>
          </div>

          {showLinkDevice ? (
            <form onSubmit={handleLinkDevice}>
              <p style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--bc-text-secondary)' }}>
                Introduce la URL de tu Google Script para sincronizar este equipo con tu base de datos compartida.
              </p>
              <div className="form-group">
                <label>URL de Google Script</label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={tempScriptUrl}
                  onChange={(e) => setTempScriptUrl(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="bc-button login-button">Vincular e Importar</button>
              <button type="button" onClick={() => setShowLinkDevice(false)} className="bc-link" style={{ marginTop: '12px', width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
                Volver al Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              {error && <p className="error-message" style={{ color: 'var(--bc-error)', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}
              <button type="submit" className="bc-button login-button">Entrar</button>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--bc-border)', textAlign: 'center' }}>
                <button type="button" onClick={() => setShowLinkDevice(true)} className="bc-link" style={{ fontSize: '13px', color: 'var(--bc-blue)', border: 'none', background: 'none', cursor: 'pointer' }}>
                  ¿Vincular otro dispositivo?
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Truck size={24} />
          {isSidebarOpen && <span>Mantenimientos</span>}
        </div>
        <div className="sidebar-content">
          <SidebarItem icon={LayoutDashboard} label="Cuadro de Mando" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Truck} label="Vehículos" active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
          <SidebarItem icon={ClipboardList} label="Mantenimiento" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
          <SidebarItem icon={Settings} label="Configuración" active={activeTab === 'auxiliary'} onClick={() => setActiveTab('auxiliary')} />
          {user.role === 'admin' && (
            <SidebarItem icon={Database} label="Importar Datos" active={activeTab === 'import'} onClick={() => setActiveTab('import')} />
          )}
          <SidebarItem icon={FileText} label="Informes" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </div>
        <div className="sidebar-footer">
          <SidebarItem icon={LogOut} label="Cerrar Sesión" onClick={() => setUser(null)} />
        </div>
      </div>

      <div className="main-container">
        <header className="app-header">
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={20} /></button>
          <div className="header-breadcrumbs">
            <span>Inicio</span>
            <ChevronRight size={16} />
            <span className="current-page">
              {activeTab === 'dashboard' && 'Cuadro de Mando'}
              {activeTab === 'vehicles' && 'Vehículos'}
              {activeTab === 'maintenance' && 'Gestión de Mantenimiento'}
              {activeTab === 'auxiliary' && 'Tablas Auxiliares'}
              {activeTab === 'import' && user.role === 'admin' && 'Importación Masiva'}
              {activeTab === 'reports' && 'Informes de Flota'}
            </span>
          </div>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isSyncing ? 'var(--bc-blue)' : 'var(--bc-text-secondary)' }}>
              {isSyncing ? (
                <>
                  <Database size={14} className="animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Database size={14} color={db.get().reportSettings?.googleScriptUrl ? 'var(--bc-success)' : 'var(--bc-grey-60)'} />
                  <span>{db.get().reportSettings?.googleScriptUrl ? 'En línea' : 'Local'}</span>
                </>
              )}
            </div>
            <span>{user.username}</span>
          </div>
        </header>

        <main className="app-content">
          {activeTab === 'dashboard' && <Dashboard key={lastUpdated} />}
          {activeTab === 'vehicles' && <Vehicles key={lastUpdated} />}
          {activeTab === 'maintenance' && <Maintenance key={lastUpdated} />}
          {activeTab === 'auxiliary' && <Auxiliary user={user} key={lastUpdated} />}
          {activeTab === 'import' && <Import user={user} key={lastUpdated} />}
          {activeTab === 'reports' && <Reports key={lastUpdated} />}
        </main>
      </div>

      {showAutoReportModal && (
        <div className="modal-overlay">
          <div className="bc-card modal-content" style={{ width: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--bc-blue)', marginBottom: '16px' }}>
              <Mail size={32} />
              <h2 style={{ margin: 0 }}>Envío Programado de Informes</h2>
            </div>
            <p>Es el momento programado para enviar los informes de mantenimiento a los coordinadores.</p>

            <div style={{ margin: '24px 0', border: '1px solid var(--bc-border)', borderRadius: '4px', overflow: 'hidden' }}>
              <table className="bc-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Coordinador</th>
                    <th>Sistema</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCoordinators.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No hay coordinadores configurados.</td></tr>
                  ) : (
                    pendingCoordinators.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td style={{ fontSize: '12px' }}>{c.systemId ? db.get().systems.find(s => s.id === c.systemId)?.value : 'TODOS'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a
                              href={`mailto:${c.email}?subject=Aviso: Mantenimientos de Flota - ${new Date().toLocaleDateString()}&body=Hola ${c.name},\n\nEste es el informe de mantenimientos pendientes para ${c.systemId ? `el sistema ${db.get().systems.find(s => s.id === c.systemId)?.value}` : 'todos los sistemas'}.\n\n${generateReportText(c.systemId).replace(/\n/g, '%0D%0A')}\n\nAccede a la aplicación para más detalles: ${window.location.protocol}//${window.location.host}`}
                              className="bc-button"
                              style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bc-grey-10)', color: 'var(--bc-text)' }}
                              title="Abrir en gestor de correo"
                            >
                              <Mail size={12} />
                              Manual
                            </a>
                            {sendingStatus[c.id] === 'sending' && <span style={{ fontSize: '11px', color: 'var(--bc-blue)' }}>Enviando...</span>}
                            {sendingStatus[c.id] === 'success' && <span style={{ fontSize: '11px', color: 'var(--bc-success)' }}>✓ Enviado</span>}
                            {sendingStatus[c.id] === 'error' && <span style={{ fontSize: '11px', color: 'var(--bc-error)' }}>✗ Error</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: 'rgb(255, 248, 230)', padding: '12px', borderRadius: '4px', borderLeft: '4px solid var(--bc-warning)', marginBottom: '24px', display: 'flex', gap: '12px' }}>
              <AlertCircle size={20} color="var(--bc-warning)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  <strong>Envío automático activado:</strong> Haz clic en "Enviar Todo Ahora" para procesar los correos vía Google Script.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="bc-button" onClick={sendAllEmails} style={{ backgroundColor: 'var(--bc-blue)' }}>
                <Mail size={16} style={{ marginRight: '8px' }} />
                Enviar Todo Ahora
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="bc-button-secondary" onClick={() => setShowAutoReportModal(false)}>Posponer</button>
                <button className="bc-button" onClick={handleFinishAutoSend}>Finalizar de Hoy</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

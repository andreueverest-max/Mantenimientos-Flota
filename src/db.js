const BLANK_DATA = {
  vehicles: [],
  brands: [],
  models: [],
  vehicleTypes: [],
  systems: [],
  maintenanceTypes: [],
  oilTypes: [],
  operators: [],
  maintenancePlans: [],
  history: [],
  coordinators: [], // { id, name, role, email, systemId }
  reportSettings: {
    dayOfWeek: 'Monday',
    hour: '09:00',
    lastSent: null,
    enabled: false,
    googleScriptUrl: ''
  },
  users: [
    { username: 'admin', password: 'password123', role: 'admin' }
  ]
};

const INITIAL_DATA = {
  vehicles: [
    { id: '0001', licensePlate: '1234ABC', brandId: '1', modelId: '1', systemId: '1', status: 'Activo', greaseType: 'Manual', notes: 'Vehículo de prueba' },
    { id: '0002', licensePlate: '5678DEF', brandId: '2', modelId: '2', systemId: '2', status: 'Activo', greaseType: 'Automático', notes: '' },
  ],
  brands: [
    { id: '1', value: 'Volvo' },
    { id: '2', value: 'Scania' },
    { id: '3', value: 'Mercedes-Benz' },
    { id: '4', value: 'MAN' },
  ],
  models: [
    { id: '1', value: 'FH16' },
    { id: '2', value: 'R500' },
    { id: '3', value: 'Actros' },
    { id: '4', value: 'TGX' },
  ],
  vehicleTypes: [],
  systems: [
    { id: '1', value: 'CADENAS' },
    { id: '2', value: 'CADENAS Y MINI' },
    { id: '3', value: 'CAMION GRUA' },
    { id: '4', value: 'FRONTAL' },
    { id: '5', value: 'GANCHO' },
    { id: '6', value: 'PULPO' },
    { id: '7', value: 'REMOLQUE' },
    { id: '8', value: 'TRACTORA' },
  ],
  maintenanceTypes: [
    { id: '1', value: 'Engrase' },
    { id: '2', value: 'Engrase 5ª Rueda' },
    { id: '3', value: 'Soplado' },
    { id: '4', value: 'Cambio de Aceite' },
  ],
  oilTypes: [
    { id: '1', value: '15W40 Sintético' },
    { id: '2', value: '10W40 Semisintético' },
    { id: '3', value: 'Valvulina 80W90' },
  ],
  operators: [
    { id: '1', value: 'Juan Pérez' },
    { id: '2', value: 'García Martínez' },
    { id: '3', value: 'Luis Fernández' },
  ],
  maintenancePlans: [
    { id: '1', vehicleId: '0001', maintenanceTypeId: '1', periodDays: 30, periodKm: 5000, oilTypeId: '1', status: 'Activo' },
    { id: '2', vehicleId: '0001', maintenanceTypeId: '2', periodDays: 15, periodKm: 2000, oilTypeId: '2', status: 'Activo' },
  ],
  history: [
    { id: '1', date: '2026-01-15', planId: '1', operatorId: '1', observations: 'Todo correcto' },
  ],
  coordinators: [
    { id: '1', name: 'Coordinador Ejemplo', role: 'Gestor de Flota', email: 'coordinador@ejemplo.com', systemId: '1' },
    { id: '2', name: 'Resp. Tráfico', role: 'Jefe de Tráfico', email: 'trafico@ejemplo.com', systemId: '' },
  ],
  reportSettings: {
    dayOfWeek: 'Monday',
    hour: '09:00',
    lastSent: null,
    enabled: true,
    googleScriptUrl: ''
  },
  users: [
    { username: 'admin', password: 'password123', role: 'admin' }
  ]
};

const DB_KEY = 'mantenimientos_db';

export const db = {
  getInitial: () => {
    return INITIAL_DATA;
  },
  get: () => {
    const stored = localStorage.getItem(DB_KEY);
    if (!stored) {
      localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DATA));
      return INITIAL_DATA;
    }
    const parsed = JSON.parse(stored);
    // Ensure all keys exist from BLANK_DATA
    return { ...BLANK_DATA, ...parsed };
  },
  save: (data) => {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    // Trigger background sync if URL exists
    if (data.reportSettings?.googleScriptUrl) {
      db.syncSave(data).catch(console.error);
    }
  },
  syncFetch: async (silent = false) => {
    const localData = db.get();
    const url = localData.reportSettings?.googleScriptUrl;
    if (!url) return { success: false, data: localData, error: 'URL no configurada' };

    try {
      const response = await fetch(url + '?t=' + new Date().getTime()); // Anti-cache

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return { success: false, data: localData, error: 'PERMISOS_SCRIPTS' };
      }

      const cloudData = await response.json();

      if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
        if (!cloudData.users && !cloudData.vehicles) {
          return { success: false, data: localData, error: 'ESTRUCTURA_INVALIDA' };
        }

        const merged = { ...localData, ...cloudData };
        merged.reportSettings.googleScriptUrl = url;

        localStorage.setItem(DB_KEY, JSON.stringify(merged));
        localStorage.setItem('lastSyncSuccess', new Date().getTime().toString());

        return { success: true, data: merged };
      }
      return { success: false, data: localData, error: 'NUBE_VACIA' };
    } catch (err) {
      if (!silent) console.error('Error syncing from cloud:', err);
      return { success: false, data: localData, error: 'ERROR_CONEXION', details: err.message };
    }
  },
  syncPush: async () => {
    const data = db.get();
    return db.syncSave(data);
  },
  syncSave: async (data) => {
    const url = data.reportSettings?.googleScriptUrl;
    if (!url) return;

    try {
      const params = new URLSearchParams();
      params.append('db_data', JSON.stringify(data));

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: params
      });
      console.log('Data synced to cloud successfully');
    } catch (err) {
      console.error('Error syncing to cloud:', err);
    }
  },
  getBlank: () => {
    return BLANK_DATA;
  },
  reset: () => {
    localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  },
  clear: () => {
    localStorage.setItem(DB_KEY, JSON.stringify(BLANK_DATA));
    return BLANK_DATA;
  }
};

export const generateReportText = (systemId) => {
  const data = db.get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseSafeDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('-')) return new Date(dateStr);
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(`${y}-${m}-${d}`);
    }
    return new Date(dateStr);
  };

  const reportItems = [];
  data.maintenancePlans.forEach(plan => {
    if (plan.status !== 'Activo') return;
    const vehicle = data.vehicles.find(v => v.id === plan.vehicleId);
    if (!vehicle || vehicle.status === 'Baja') return;
    if (systemId && vehicle.systemId !== systemId) return;

    const planHistory = data.history.filter(h => h.planId === plan.id);
    let daysOverdue = 0;
    let status = 'En Plazo';

    if (planHistory.length > 0) {
      const sortedHistory = [...planHistory].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
      const lastDateParsed = parseSafeDate(sortedHistory[0].date);
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
      status = 'Pendiente';
      daysOverdue = 9999; // Treat as highly urgent for sorting
    }

    if (status !== 'En Plazo') {
      const sysName = data.systems.find(s => s.id === vehicle.systemId)?.value || 'N/A';
      const planName = data.maintenanceTypes.find(t => t.id === plan.maintenanceTypeId)?.value || 'N/A';
      reportItems.push({
        text: `- Vehículo ${vehicle.id} (${vehicle.licensePlate}) [${sysName}]: ${planName} (${status}${daysOverdue > 0 && daysOverdue !== 9999 ? `, ${daysOverdue} días vencido` : ''})`,
        daysOverdue
      });
    }
  });

  if (reportItems.length === 0) return 'No hay mantenimientos vencidos ni pendientes para este sistema.';

  // Sort descending by daysOverdue
  reportItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return `MANTENIMIENTOS PENDIENTES/VENCIDOS:\n\n${reportItems.map(i => i.text).join('\n')}`;
};

export const generateReportHTML = (systemId) => {
  const data = db.get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseSafeDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('-')) return new Date(dateStr);
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(`${y}-${m}-${d}`);
    }
    return new Date(dateStr);
  };

  const reportItems = [];
  let totalCount = 0;
  let overdueCount = 0;
  let inTimeCount = 0;

  data.maintenancePlans.forEach(plan => {
    if (plan.status !== 'Activo') return;
    const vehicle = data.vehicles.find(v => v.id === plan.vehicleId);
    if (!vehicle || vehicle.status === 'Baja') return;
    if (systemId && vehicle.systemId !== systemId) return;

    totalCount++;
    const planHistory = data.history.filter(h => h.planId === plan.id);
    let daysOverdue = 0;
    let status = 'En Plazo';
    let statusColor = '#10b981'; // Success green

    if (planHistory.length > 0) {
      const sortedHistory = [...planHistory].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
      const lastDateParsed = parseSafeDate(sortedHistory[0].date);
      const periodDays = parseInt(plan.periodDays) || 0;
      if (periodDays > 0) {
        const dueDate = new Date(lastDateParsed);
        dueDate.setDate(dueDate.getDate() + periodDays);
        if (today > dueDate) {
          const diffTime = Math.abs(today - dueDate);
          daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          status = 'Vencido';
          statusColor = '#ef4444'; // Error red
          overdueCount++;
        } else {
          inTimeCount++;
        }
      } else {
        inTimeCount++;
      }
    } else {
      status = 'Pendiente';
      statusColor = '#f59e0b'; // Warning orange
      daysOverdue = 9999;
      overdueCount++;
    }

    if (status !== 'En Plazo') {
      const sysName = data.systems.find(s => s.id === vehicle.systemId)?.value || 'N/A';
      const planName = data.maintenanceTypes.find(t => t.id === plan.maintenanceTypeId)?.value || 'N/A';

      reportItems.push({
        html: `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${vehicle.licensePlate}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${sysName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${planName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 99px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
              ${status}${daysOverdue > 0 && daysOverdue !== 9999 ? ` (${daysOverdue}d)` : ''}
            </span>
          </td>
        </tr>
      `,
        daysOverdue
      });
    }
  });

  // Sort descending by daysOverdue
  reportItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const sysTitle = systemId ? data.systems.find(s => s.id === systemId)?.value : 'TODOS LOS SISTEMAS';

  return `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #059669; color: white; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Informe de Mantenimiento</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-weight: bold;">${sysTitle}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Generado el ${today.toLocaleDateString()}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: center;">
        <div style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Vehículos</div>
          <div style="font-size: 18px; font-weight: bold; color: #1e293b;">${totalCount}</div>
        </div>
        <div style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #ef4444; text-transform: uppercase; margin-bottom: 4px;">Vencidos</div>
          <div style="font-size: 18px; font-weight: bold; color: #ef4444;">${overdueCount}</div>
        </div>
        <div style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #10b981; text-transform: uppercase; margin-bottom: 4px;">Al día</div>
          <div style="font-size: 18px; font-weight: bold; color: #10b981;">${inTimeCount}</div>
        </div>
      </div>

      <div style="padding: 24px;">
        ${reportItems.length > 0 ? `
          <h3 style="margin-top: 0; font-size: 16px; border-left: 4px solid #f59e0b; padding-left: 10px; color: #1e293b;">Atención necesaria</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #475569;">Vehículo</th>
                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #475569;">Sistema</th>
                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #475569;">Tarea</th>
                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #475569;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${reportItems.map(i => i.html).join('')}
            </tbody>
          </table>
        ` : `
          <div style="text-align: center; padding: 40px; color: #64748b;">
            <p style="font-size: 16px; margin: 0;">✅ Todos los mantenimientos están al día.</p>
          </div>
        `}
      </div>
      <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Este es un mensaje automático del Sistema de Gestión de Flota.
      </div>
    </div>
  `;
};

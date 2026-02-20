import React, { useState, useEffect } from 'react';
import { db } from '../db';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, PieChart, Pie, Legend
} from 'recharts';
import { Truck, AlertTriangle, CheckCircle, Clock, TrendingUp, PieChart as PieIcon, Search } from 'lucide-react';

const Dashboard = () => {
    const [data, setData] = useState(db.get());

    const parseSafeDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('-')) return new Date(dateStr);
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return new Date(`${y}-${m}-${d}`);
        }
        return new Date(dateStr);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- KPI CALCULATIONS ---
    const vehiclesActive = data.vehicles.filter(v =>
        v.status?.toLowerCase() === 'activo' || v.status?.toLowerCase() === 'alta'
    ).length;
    const totalVehicles = data.vehicles.length;

    const [selectedDetail, setSelectedDetail] = useState(null); // 'overdue' | 'upcoming' | null
    const [overdueList, setOverdueList] = useState([]);
    const [upcomingList, setUpcomingList] = useState([]);
    const [upToDateCount, setUpToDateCount] = useState(0);

    useEffect(() => {
        const ovList = [];
        const upList = [];
        let utdCount = 0;

        data.maintenancePlans.forEach(plan => {
            if (plan.status?.toLowerCase() !== 'activo') return;
            const vehicle = data.vehicles.find(v => v.id === plan.vehicleId);
            if (!vehicle || vehicle.status?.toLowerCase() === 'baja') return;

            const mType = data.maintenanceTypes.find(t => t.id === plan.maintenanceTypeId)?.value || 'General';
            const history = data.history.filter(h => h.planId === plan.id);

            let lastDate;
            if (history.length === 0) {
                lastDate = new Date(0);
                ovList.push({ vehicle, plan, type: mType, dueDate: 'Nunca realizado' });
                return;
            } else {
                const sortedHistory = [...history].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
                lastDate = parseSafeDate(sortedHistory[0].date);
            }

            const period = parseInt(plan.periodDays) || 0;
            if (period > 0) {
                const dueDate = new Date(lastDate);
                dueDate.setDate(dueDate.getDate() + period);

                if (today > dueDate) {
                    ovList.push({
                        vehicle,
                        plan,
                        type: mType,
                        dueDate: dueDate.toLocaleDateString(),
                        days: Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
                    });
                } else {
                    const diffTime = dueDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) {
                        upList.push({
                            vehicle,
                            plan,
                            type: mType,
                            dueDate: dueDate.toLocaleDateString(),
                            days: diffDays
                        });
                    } else {
                        utdCount++;
                    }
                }
            } else {
                utdCount++;
            }
        });

        setOverdueList(ovList);
        setUpcomingList(upList);
        setUpToDateCount(utdCount);
    }, [data, today]);

    const [listSearch, setListSearch] = useState('');

    const overdueCount = overdueList.length;
    const upcomingCount = upcomingList.length;

    const filteredList = (selectedDetail === 'overdue' ? overdueList : upcomingList).filter(item =>
        item.vehicle.id.includes(listSearch) ||
        item.vehicle.licensePlate.toLowerCase().includes(listSearch.toLowerCase()) ||
        item.type.toLowerCase().includes(listSearch.toLowerCase())
    );

    const statusChartData = [
        { name: 'Al día', value: upToDateCount, color: 'var(--bc-success)' },
        { name: 'Próximos', value: upcomingCount, color: 'var(--bc-warning)' },
        { name: 'Vencidos', value: overdueCount, color: 'var(--bc-error)' },
    ];

    // --- WEEKLY TREND (6 MONTHS) ---
    const getWeeklyTrend = () => {
        const weeks = [];
        const start = new Date(today);
        start.setMonth(start.getMonth() - 6);

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        // Align to Monday
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        let current = new Date(start);
        while (current <= today) {
            const next = new Date(current);
            next.setDate(next.getDate() + 7);

            const count = data.history.filter(h => {
                const d = parseSafeDate(h.date);
                return d >= current && d < next;
            }).length;

            weeks.push({
                name: `${current.getDate()} ${monthNames[current.getMonth()]}`,
                mantenimientos: count,
                timestamp: current.getTime()
            });
            current = next;
        }
        return weeks;
    };

    // --- PIE CHART BY TYPE (LAST MONTH) ---
    const getPieData = () => {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const recentHistory = data.history.filter(h => parseSafeDate(h.date) >= lastMonth);
        const typeCounts = {};

        recentHistory.forEach(h => {
            const plan = data.maintenancePlans.find(p => p.id === h.planId);
            if (plan) {
                const typeName = data.maintenanceTypes.find(t => t.id === plan.maintenanceTypeId)?.value || 'Otros';
                typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
            }
        });

        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
        return Object.keys(typeCounts).map((name, index) => ({
            name,
            value: typeCounts[name],
            color: COLORS[index % COLORS.length]
        }));
    };

    const weeklyTrendData = getWeeklyTrend();
    const pieData = getPieData();

    const lastSyncTime = localStorage.getItem('lastSyncSuccess');
    const syncStatusText = lastSyncTime ? `Sincronizado: ${new Date(parseInt(lastSyncTime)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Actualizado localmente';

    return (
        <div className="dashboard" style={{ fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Panel de Control y Analítica</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--bc-grey-130)' }}>{syncStatusText}</div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '12px', gap: '8px' }}>
                <div className="bc-card kpi-card" style={{ padding: '8px 12px' }}>
                    <div className="kpi-label">Vehículos</div>
                    <div className="kpi-value">{totalVehicles}</div>
                    <Truck size={14} color="var(--bc-blue)" />
                </div>
                <div className="bc-card kpi-card" style={{ padding: '8px 12px' }}>
                    <div className="kpi-label">Activos</div>
                    <div className="kpi-value">{vehiclesActive}</div>
                    <CheckCircle size={14} color="var(--bc-success)" />
                </div>
                <div
                    className="bc-card kpi-card clickable"
                    style={{ padding: '8px 12px', cursor: 'pointer', border: selectedDetail === 'overdue' ? '1px solid var(--bc-error)' : '1px solid transparent' }}
                    onClick={() => {
                        setSelectedDetail(selectedDetail === 'overdue' ? null : 'overdue');
                        setListSearch('');
                    }}
                    title="Click para ver lista de vencidos"
                >
                    <div className="kpi-label">Vencidos</div>
                    <div className="kpi-value" style={{ color: overdueCount > 0 ? 'var(--bc-error)' : 'inherit' }}>{overdueCount}</div>
                    <AlertTriangle size={14} color="var(--bc-error)" />
                </div>
                <div
                    className="bc-card kpi-card clickable"
                    style={{ padding: '8px 12px', cursor: 'pointer', border: selectedDetail === 'upcoming' ? '1px solid var(--bc-warning)' : '1px solid transparent' }}
                    onClick={() => {
                        setSelectedDetail(selectedDetail === 'upcoming' ? null : 'upcoming');
                        setListSearch('');
                    }}
                    title="Click para ver lista de próximos"
                >
                    <div className="kpi-label">Próximos</div>
                    <div className="kpi-value" style={{ color: upcomingCount > 0 ? 'var(--bc-warning)' : 'inherit' }}>{upcomingCount}</div>
                    <Clock size={14} color="var(--bc-warning)" />
                </div>
            </div>

            {/* Modal / Detail View */}
            {selectedDetail && (
                <div className="bc-card" style={{ marginBottom: '12px', border: `1px solid var(--bc-${selectedDetail === 'overdue' ? 'error' : 'warning'})` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h4 style={{ margin: 0, color: `var(--bc-${selectedDetail === 'overdue' ? 'error' : 'warning'})`, fontSize: '0.85rem' }}>
                                {selectedDetail === 'overdue' ? `MANTENIMIENTOS VENCIDOS (${overdueCount})` : `MANTENIMIENTOS PRÓXIMOS (${upcomingCount})`}
                            </h4>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Buscar en lista..."
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    style={{
                                        fontSize: '0.7rem',
                                        padding: '2px 8px 2px 24px',
                                        border: '1px solid var(--bc-border)',
                                        borderRadius: '12px',
                                        width: '150px'
                                    }}
                                />
                                <Search size={10} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--bc-grey-130)' }} />
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedDetail(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--bc-grey-130)' }}
                        >
                            &times;
                        </button>
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.75rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '1px solid var(--bc-border)', zIndex: 1 }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '4px', width: '12%' }}>Nº</th>
                                    <th style={{ textAlign: 'left', padding: '4px', width: '30%' }}>Matrícula</th>
                                    <th style={{ textAlign: 'left', padding: '4px', width: '30%' }}>Tipo</th>
                                    <th style={{ textAlign: 'left', padding: '4px', width: '15%' }}>Vence</th>
                                    <th style={{ textAlign: 'right', padding: '4px', width: '13%' }}>{selectedDetail === 'overdue' ? 'Retraso' : 'Faltan'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.length > 0 ? filteredList.map((item, idx) => {
                                    const brandName = data.brands.find(b => b.id === item.vehicle.brandId)?.value || '';
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '4px', fontWeight: 'bold' }}>{item.vehicle.id}</td>
                                            <td style={{ padding: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${item.vehicle.licensePlate} (${brandName})`}>
                                                {item.vehicle.licensePlate} <small style={{ color: '#666' }}>({brandName})</small>
                                            </td>
                                            <td style={{ padding: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.type}>{item.type}</td>
                                            <td style={{ padding: '4px' }}>{item.dueDate}</td>
                                            <td style={{ padding: '4px', textAlign: 'right', color: selectedDetail === 'overdue' ? 'var(--bc-error)' : 'var(--bc-warning)' }}>
                                                {item.days !== undefined ? `${item.days} d` : '-'}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--bc-grey-130)' }}>No se encontraron coincidencias</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* All charts in one horizontal line */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) 2fr', gap: '12px' }}>

                {/* 1. Status Bar Chart (Smallest) */}
                <div className="bc-card" style={{ padding: '10px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Estado Planes
                    </h3>
                    <div style={{ height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 9 }} hide={false} />
                                <YAxis tick={{ fontSize: 9 }} />
                                <Tooltip labelStyle={{ fontSize: '10px' }} itemStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="value" barSize={25}>
                                    {statusChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Pie Chart (Middle) */}
                <div className="bc-card" style={{ padding: '10px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Tipos (Mes)
                    </h3>
                    <div style={{ height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={35}
                                    outerRadius={50}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip labelStyle={{ fontSize: '10px' }} itemStyle={{ fontSize: '10px' }} />
                                <Legend
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '9px', bottom: 0 }}
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Weekly Trend Line Chart (Widest) */}
                <div className="bc-card" style={{ padding: '10px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Tendencia Semanal (6 meses)
                    </h3>
                    <div style={{ height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weeklyTrendData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" interval={4} tick={{ fontSize: 9 }} />
                                <YAxis tick={{ fontSize: 9 }} />
                                <Tooltip labelStyle={{ fontSize: '10px' }} itemStyle={{ fontSize: '10px' }} />
                                <Line
                                    type="monotone"
                                    dataKey="mantenimientos"
                                    stroke="var(--bc-blue)"
                                    strokeWidth={1.5}
                                    dot={{ r: 2 }}
                                    activeDot={{ r: 4 }}
                                    name="Mantos."
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;

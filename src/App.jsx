import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MONTHS_FULL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const FISCAL_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];

const INITIAL_EXPENSE_CONCEPTS = {
  GASTOS_OPERACION: [
    'OTRAS PRESBITERIO', 'APOYO MANUTENCION PBTRO.JOSIAS', 'ESTIMULO VIVIENDA,ETC PBTRO. JOSIAS',
    'SEGURO E INF PBTRO JOSIAS', 'APOYO MINISTRO DE MUSICA AGUSTIN', 'APOYO MEDICO AGUSTIN',
    'APOYO GUARDA TEMPLO', 'APOYO MISION DE XOXO', 'APOYO PERSONAL DE LIMPIEZA',
    'RENTA', 'TEL', 'AGUA', 'COCINA', 'PAPELERIA', 'LUZ', 'MANTTO IGLESIA'
  ],
  GASTOS_MINISTERIOS: [
    'MINISTERIO ADORACION', 'MINISTERIO AMBIENTACION', 'MINISTERIO INFANTIL', 'MINISTERIO DE EDUCACION',
    'MINISTERIO DE MUJERES', 'MINISTERIO DE VARONES', 'MINISTERIO JUVENIL', 'CECAM',
    'MINISTERIO MATRIMONIOS', 'CABINA', 'MINIS REDES', 'MISERICORDIA', 'EVANGELISMO',
    'UJIERES', 'CONSISTORIO', 'DIACONIA'
  ]
};

export default function App() {
  const [role, setRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Tesorero');
  const [pinInput, setPinInput] = useState('');
  const [pins, setPins] = useState(() => {
    const saved = localStorage.getItem('balanza_ipap_pins_v8');
    return saved ? JSON.parse(saved) : { Admin: '1234', Tesorero: '2222', Visitante: '0000' };
  });
  const [pinError, setPinError] = useState('');

  const [cloudStatus, setCloudStatus] = useState("Conectando a Supabase...");
  const [toastMsg, setToastMsg] = useState('');
  
  const [activeModule, setActiveModule] = useState('diezmos');
  const [activeTab, setActiveTab] = useState('balanza');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(11); // Diciembre por defecto
  const [fiscalYear, setFiscalYear] = useState(() => localStorage.getItem('balanza_ipap_fiscal_year_v8') || '2025');

  const [budgetData, setBudgetData] = useState([]);
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('balanza_ipap_audit_logs_v8');
    return saved ? JSON.parse(saved) : [];
  });

  const [entryDate, setEntryDate] = useState('');
  const [entryConcept, setEntryConcept] = useState('');
  const [entryExtraData, setEntryExtraData] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState('Ingreso');
  const [expenseRubro, setExpenseRubro] = useState(INITIAL_EXPENSE_CONCEPTS.GASTOS_OPERACION[0]);

  // Settings & Modals
  const [newAdminPin, setNewAdminPin] = useState('');
  const [newTesoreroPin, setNewTesoreroPin] = useState('');
  const [newVisitantePin, setNewVisitantePin] = useState('');
  const [secMsg, setSecMsg] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmPinModalInput, setConfirmPinModalInput] = useState('');
  const [modalError, setModalError] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

  // Cargar datos desde Supabase
  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from('movimientos_ipap').select('*').order('id', { ascending: true });
      if (error) throw error;
      setBudgetData(data || []);
      setCloudStatus("🟢 Nube Supabase Conectada");
    } catch (error) {
      console.error("Error al cargar Supabase:", error);
      setCloudStatus("🔴 Error de conexión");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const m = String(selectedMonthIdx + 1).padStart(2, '0');
    setEntryDate(`${fiscalYear}-${m}-01`);
  }, [fiscalYear, selectedMonthIdx]);

  useEffect(() => { localStorage.setItem('balanza_ipap_audit_logs_v8', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('balanza_ipap_fiscal_year_v8', fiscalYear); }, [fiscalYear]);
  useEffect(() => { localStorage.setItem('balanza_ipap_pins_v8', JSON.stringify(pins)); }, [pins]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === pins[selectedRole]) {
      setRole(selectedRole);
      setPinError('');
      setPinInput('');
      setActiveTab(selectedRole === 'Visitante' ? 'dashboard' : 'balanza');
    } else {
      setPinError(`PIN incorrecto para el rol de ${selectedRole}.`);
    }
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    
    let conceptName = '';
    if (entryType === 'Ingreso') {
      conceptName = activeModule === 'ofrendas' ? 'OFRENDAS GENERALES' : entryConcept.trim().toUpperCase();
      if (!conceptName) return;
    } else {
      conceptName = expenseRubro;
    }

    if (!entryAmount || parseFloat(entryAmount) <= 0) return;
    const amt = Math.round(parseFloat(entryAmount));
    const extraNote = entryExtraData.trim();
    const dateYear = entryDate.split('-')[0] || fiscalYear;

    const existingItem = budgetData.find(item => 
      item.module === activeModule && item.year === dateYear &&
      item.type === entryType && item.date === entryDate &&
      item.concept.trim().toUpperCase() === conceptName
    );

    try {
      if (existingItem && entryType === 'Ingreso' && activeModule === 'diezmos') {
        const updatedAmount = Number(existingItem.amount) + amt;
        const combinedExtra = existingItem.extraData ? (extraNote ? `${existingItem.extraData}, ${extraNote}` : existingItem.extraData) : extraNote;
        
        const { error } = await supabase.from('movimientos_ipap').update({ amount: updatedAmount, extraData: combinedExtra }).eq('id', existingItem.id);
        if (error) throw error;
        showToast(`✅ Movimiento sumado a "${conceptName}". Nuevo total: $${updatedAmount.toLocaleString('es-MX')}`);
      } else {
        const { error } = await supabase.from('movimientos_ipap').insert([{
          module: activeModule, year: dateYear, date: entryDate, concept: conceptName,
          extraData: extraNote, type: entryType, amount: amt
        }]);
        if (error) throw error;
        showToast(`✅ Movimiento guardado con éxito: $${amt.toLocaleString('es-MX')} en ${activeModule.toUpperCase()}.`);
      }
      
      setEntryConcept('');
      setEntryExtraData('');
      setEntryAmount('');
      fetchData(); // Recargar datos frescos
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDeleteRecord = async (id) => {
    const target = budgetData.find(i => i.id === id);
    if (!target) return;

    if (window.confirm(`¿Seguro de eliminar "${target.concept}" por $${Number(target.amount).toLocaleString('es-MX')}?`)) {
      try {
        const { error } = await supabase.from('movimientos_ipap').delete().eq('id', id);
        if (error) throw error;

        const auditEntry = {
          id: Date.now(), deletedAt: new Date().toLocaleString('es-MX'),
          concept: target.concept, extraData: target.extraData || '',
          amount: target.amount, date: target.date, module: target.module,
          year: target.year, deletedBy: role
        };
        setAuditLogs([auditEntry, ...auditLogs]);
        showToast(`🗑️ "${target.concept}" eliminado correctamente.`);
        fetchData();
      } catch(error) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const handleConfirmZeroReset = async (e) => {
    e.preventDefault();
    if (confirmPinModalInput === pins.Admin) {
      try {
        const toDelete = budgetData.filter(i => i.module === activeModule && i.year === fiscalYear);
        for (const item of toDelete) {
          await supabase.from('movimientos_ipap').delete().eq('id', item.id);
        }
        setIsResetModalOpen(false);
        setConfirmPinModalInput('');
        setModalError('');
        showToast(`🧹 Balanza de ${activeModule.toUpperCase()} para el año ${fiscalYear} formateada a $0.`);
        fetchData();
      } catch (error) {
        alert("Error al formatear: " + error.message);
      }
    } else {
      setModalError('PIN de Administrador incorrecto. Operación cancelada.');
    }
  };

  const handleUpdatePins = (e) => {
    e.preventDefault();
    const newP = { ...pins };
    if (newAdminPin.trim()) newP.Admin = newAdminPin.trim();
    if (newTesoreroPin.trim()) newP.Tesorero = newTesoreroPin.trim();
    if (newVisitantePin.trim()) newP.Visitante = newVisitantePin.trim();
    setPins(newP);
    setNewAdminPin(''); setNewTesoreroPin(''); setNewVisitantePin('');
    setSecMsg('¡Claves de acceso actualizadas con éxito!');
    setTimeout(() => setSecMsg(''), 3000);
  };

  const currentRecords = useMemo(() => {
    const monthNum = String(selectedMonthIdx + 1).padStart(2, '0');
    return budgetData.filter(i => i.module === activeModule && i.year === fiscalYear && i.date.split('-')[1] === monthNum)
                     .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [budgetData, activeModule, fiscalYear, selectedMonthIdx]);

  const monthTotals = useMemo(() => {
    let totalIngresos = 0;
    let totalEgresos = 0;
    currentRecords.forEach(i => {
      if (i.type === 'Ingreso') totalIngresos += Number(i.amount);
      if (i.type === 'Egreso') totalEgresos += Number(i.amount);
    });

    const presbiterio10 = Math.round(totalIngresos * 0.10);
    const totalEgresosConPresbiterio = totalEgresos + presbiterio10;
    const initialSaldo = activeModule === 'diezmos' ? 287220 : 136504; // Saldos estáticos de la app original
    const saldoSiguienteMes = initialSaldo + totalIngresos - totalEgresosConPresbiterio;
    const sumasIguales = totalIngresos + initialSaldo;

    return { totalIngresos, totalEgresos, presbiterio10, totalEgresosConPresbiterio, initialSaldo, saldoSiguienteMes, sumasIguales };
  }, [currentRecords, activeModule]);

  // Dashboards calculations
  const consolidatedMonthlyData = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const yearRecords = budgetData.filter(i => i.year === fiscalYear && i.date.split('-')[1] === monthNum);

      let diezmosIng = 0, diezmosEgr = 0, ofrendasIng = 0, ofrendasEgr = 0;
      yearRecords.forEach(i => {
        if (i.module === 'diezmos') {
          if (i.type === 'Ingreso') diezmosIng += Number(i.amount);
          if (i.type === 'Egreso') diezmosEgr += Number(i.amount);
        } else if (i.module === 'ofrendas') {
          if (i.type === 'Ingreso') ofrendasIng += Number(i.amount);
          if (i.type === 'Egreso') ofrendasEgr += Number(i.amount);
        }
      });

      const presb10Diezmos = Math.round(diezmosIng * 0.10);
      const presb10Ofrendas = Math.round(ofrendasIng * 0.10);
      return {
        monthLabel: m, diezmosIng, ofrendasIng,
        totalEntradas: diezmosIng + ofrendasIng,
        diezmosEgr: diezmosEgr + presb10Diezmos,
        ofrendasEgr: ofrendasEgr + presb10Ofrendas,
        totalSalidas: diezmosEgr + presb10Diezmos + ofrendasEgr + presb10Ofrendas
      };
    });
  }, [budgetData, fiscalYear]);

  const pieTotals = useMemo(() => {
    let opTotal = 0, minTotal = 0, yearTotalIngresosDiezmos = 0, yearTotalIngresosOfrendas = 0;
    const yearRecords = budgetData.filter(i => i.year === fiscalYear);
    const minConceptsSet = new Set(INITIAL_EXPENSE_CONCEPTS.GASTOS_MINISTERIOS.map(m => m.trim().toUpperCase()));

    yearRecords.forEach(item => {
      if (item.type === 'Ingreso') {
        if (item.module === 'diezmos') yearTotalIngresosDiezmos += Number(item.amount);
        if (item.module === 'ofrendas') yearTotalIngresosOfrendas += Number(item.amount);
      } else if (item.type === 'Egreso') {
        if (minConceptsSet.has((item.concept || '').trim().toUpperCase())) minTotal += Number(item.amount);
        else opTotal += Number(item.amount);
      }
    });

    const totalPresbiterio10 = Math.round(yearTotalIngresosDiezmos * 0.10) + Math.round(yearTotalIngresosOfrendas * 0.10);
    opTotal += totalPresbiterio10;

    const totalEgresosPure = opTotal + minTotal;
    return { 
      opTotal, minTotal, totalPresbiterio10, totalEgresosPure, 
      pctOp: totalEgresosPure > 0 ? (opTotal / totalEgresosPure) * 100 : 0, 
      pctMin: totalEgresosPure > 0 ? (minTotal / totalEgresosPure) * 100 : 0 
    };
  }, [budgetData, fiscalYear]);

  // VISTAS
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 font-sans">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">DIEZMOS Y OFRENDAS</h1>
            <p className="text-xs text-slate-400">Iglesia Presbiteriana - Balanza de Estados IPAP</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Perfil de Usuario:</label>
              <div className="grid grid-cols-3 gap-2">
                {['Admin', 'Tesorero', 'Visitante'].map(r => (
                  <button key={r} type="button" onClick={() => { setSelectedRole(r); setPinError(''); }}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition ${selectedRole === r ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña / PIN de Acceso:</label>
              <input type="password" required value={pinInput} onChange={e => setPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100" />
            </div>
            {pinError && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs text-center font-medium">{pinError}</div>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-sm text-white transition">Entrar al Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-y-auto">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-emerald-200">✕</button>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-lg text-white">BALANZA DE ESTADOS {fiscalYear}</h1>
          <p className="text-xs text-slate-400">Control Contable IPAP</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400">{cloudStatus}</span>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-2xl">
            <span className="text-xs font-bold text-blue-300">Año:</span>
            <select value={fiscalYear} disabled={role !== 'Admin'} onChange={(e) => setFiscalYear(e.target.value)} className="bg-transparent text-amber-400 text-xs font-bold outline-none">
              {FISCAL_YEARS.map(y => <option key={y} value={y} className="bg-slate-900 text-slate-100">{y}</option>)}
            </select>
          </div>
          <button onClick={() => setRole(null)} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold">Salir</button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {role !== 'Visitante' && (
          <div className="flex justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="flex gap-2">
              <button onClick={() => setActiveModule('diezmos')} className={`px-6 py-2.5 rounded-xl text-sm font-extrabold border ${activeModule === 'diezmos' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>📘 DIEZMOS</button>
              <button onClick={() => setActiveModule('ofrendas')} className={`px-6 py-2.5 rounded-xl text-sm font-extrabold border ${activeModule === 'ofrendas' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>📗 OFRENDAS</button>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Mes:</span>
              <select value={selectedMonthIdx} onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value))} className="bg-transparent text-xs font-bold text-amber-400 outline-none">
                {MONTHS_FULL.map((m, i) => <option key={m} value={i} className="bg-slate-900">{m}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
          {role !== 'Visitante' && <button onClick={() => setActiveTab('balanza')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'balanza' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>📄 Balanza</button>}
          {role !== 'Visitante' && <button onClick={() => setActiveTab('captura')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'captura' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>✍️ Capturar</button>}
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'dashboard' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>📊 Dashboards</button>
          {role === 'Admin' && <button onClick={() => setActiveTab('seguridad')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'seguridad' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>⚙️ Seguridad</button>}
          
          {activeTab === 'balanza' && (
            <button onClick={() => window.print()} className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold flex items-center gap-2">🖨️ Imprimir / PDF</button>
          )}
        </div>

        {/* VISTA: BALANZA */}
        {activeTab === 'balanza' && role !== 'Visitante' && (
          <div className="bg-white text-slate-900 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-black uppercase text-center border-b-2 border-slate-900 pb-4 mb-6">TESORERÍA DE {activeModule} <br/><span className="text-sm">01 AL 31 DE {MONTHS_FULL[selectedMonthIdx]} DEL {fiscalYear}</span></h2>
            <table className="w-full text-sm text-left border-collapse border border-slate-900">
              <thead className="bg-slate-100 border-b-2 border-slate-900">
                <tr>
                  <th className="p-3 border-r border-slate-900">FECHA</th>
                  <th className="p-3 border-r border-slate-900">CONCEPTO</th>
                  <th className="p-3 text-right border-r border-slate-900">INGRESOS</th>
                  <th className="p-3 text-right border-r border-slate-900">EGRESOS</th>
                  <th className="p-3 text-right bg-slate-50">SALDO</th>
                  <th className="p-2 text-center no-print">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-bold border-b border-slate-300">
                  <td className="p-2.5 text-center border-r border-slate-300">-</td>
                  <td className="p-2.5 border-r border-slate-300">SALDO DEL MES ANTERIOR</td>
                  <td className="p-2.5 border-r border-slate-300"></td><td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 text-right bg-slate-100">${monthTotals.initialSaldo.toLocaleString('es-MX')}.00</td>
                  <td className="no-print"></td>
                </tr>
                {(() => {
                  let balance = monthTotals.initialSaldo;
                  return currentRecords.map(item => {
                    if (item.type === 'Ingreso') balance += Number(item.amount);
                    if (item.type === 'Egreso') balance -= Number(item.amount);
                    return (
                      <tr key={item.id} className="border-b border-slate-300 hover:bg-slate-50">
                        <td className="p-2.5 border-r border-slate-300">{item.date}</td>
                        <td className="p-2.5 border-r border-slate-300 font-semibold">{item.concept} {item.extraData && <span className="text-slate-500 italic">({item.extraData})</span>}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-800 border-r border-slate-300">{item.type === 'Ingreso' ? `$${Number(item.amount).toLocaleString('es-MX')}.00` : ''}</td>
                        <td className="p-2.5 text-right font-bold text-rose-800 border-r border-slate-300">{item.type === 'Egreso' ? `$${Number(item.amount).toLocaleString('es-MX')}.00` : ''}</td>
                        <td className="p-2.5 text-right font-bold">${balance.toLocaleString('es-MX')}.00</td>
                        <td className="p-1 text-center no-print border-l border-slate-300"><button onClick={() => handleDeleteRecord(item.id)} className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">🗑️</button></td>
                      </tr>
                    );
                  });
                })()}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td className="p-2.5 border-r border-slate-300">FIN DE MES</td>
                  <td className="p-2.5 border-r border-slate-300">10% PRESBITERIO (AUTOMÁTICO)</td>
                  <td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 text-right text-rose-800 border-r border-slate-300">${monthTotals.presbiterio10.toLocaleString('es-MX')}.00</td>
                  <td className="p-2.5 text-right">${(monthTotals.initialSaldo + monthTotals.totalIngresos - monthTotals.totalEgresosConPresbiterio).toLocaleString('es-MX')}.00</td>
                  <td className="no-print"></td>
                </tr>
                <tr className="bg-slate-200 font-black border-t-2 border-slate-900">
                  <td colSpan="2" className="p-3.5 text-right border-r border-slate-400">SUMAS IGUALES</td>
                  <td className="p-3.5 text-right border-r border-slate-400">${monthTotals.sumasIguales.toLocaleString('es-MX')}.00</td>
                  <td className="p-3.5 text-right border-r border-slate-400">${monthTotals.sumasIguales.toLocaleString('es-MX')}.00</td>
                  <td colSpan="2" className="bg-slate-100"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA: CAPTURA */}
        {activeTab === 'captura' && role !== 'Visitante' && (
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl max-w-2xl mx-auto">
            <h3 className="text-base font-bold text-emerald-400 mb-4">Capturar Movimiento en {activeModule.toUpperCase()}</h3>
            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={entryType} onChange={e => setEntryType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"><option value="Ingreso">Ingreso (+)</option><option value="Egreso">Egreso (-)</option></select>
                <input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
              </div>
              {entryType === 'Ingreso' ? (
                activeModule === 'diezmos' ? <input type="text" required placeholder="Nombre (Ej. FAMILIA MIRANDA)" value={entryConcept} onChange={e => setEntryConcept(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100" />
                : <input type="text" readOnly value="OFRENDAS GENERALES" className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-bold" />
              ) : (
                <select value={expenseRubro} onChange={e => setExpenseRubro(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200">
                  <optgroup label="Gastos de Operación">{INITIAL_EXPENSE_CONCEPTS.GASTOS_OPERACION.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
                  <optgroup label="Gastos de Ministerios">{INITIAL_EXPENSE_CONCEPTS.GASTOS_MINISTERIOS.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
                </select>
              )}
              <input type="text" placeholder="Dato Extra Opcional (Ej. Recibo No. 12)" value={entryExtraData} onChange={e => setEntryExtraData(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100" />
              <input type="number" step="1" required placeholder="Monto ($ MXN)" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100" />
              <button type="submit" className="w-full py-3 bg-emerald-600 font-bold rounded-xl text-xs text-white">Guardar Registro en Supabase</button>
            </form>
          </div>
        )}

        {/* VISTA: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h3 className="font-bold text-slate-100 mb-6">Entradas vs Salidas Mensuales Consolidadas</h3>
              <div className="flex h-48 items-end gap-2">
                {consolidatedMonthlyData.map(d => {
                  const maxVal = Math.max(...consolidatedMonthlyData.map(x => Math.max(x.totalEntradas, x.totalSalidas)), 1);
                  return (
                    <div key={d.monthLabel} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="flex items-end gap-1 w-full h-full justify-center">
                        <div style={{ height: `${(d.totalEntradas/maxVal)*100}%` }} className="w-3 bg-emerald-500 rounded-t" title={`Entradas: $${d.totalEntradas}`}></div>
                        <div style={{ height: `${(d.totalSalidas/maxVal)*100}%` }} className="w-3 bg-rose-500 rounded-t" title={`Salidas: $${d.totalSalidas}`}></div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold mt-2">{d.monthLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <h3 className="font-bold text-slate-100">Distribución de Gastos Acumulados ({fiscalYear})</h3>
              <div className="p-4 bg-amber-950/30 rounded-2xl border border-amber-500/30">
                <span className="text-xs font-bold text-amber-400">Gastos Operación ({pieTotals.pctOp.toFixed(1)}%)</span>
                <p className="text-2xl font-black text-amber-400">${pieTotals.opTotal.toLocaleString('es-MX')}</p>
                <p className="text-xs text-slate-400">Incluye ${(pieTotals.totalPresbiterio10).toLocaleString('es-MX')} de Presbiterio</p>
              </div>
              <div className="p-4 bg-rose-950/30 rounded-2xl border border-rose-500/30">
                <span className="text-xs font-bold text-rose-400">Gastos Ministerios ({pieTotals.pctMin.toFixed(1)}%)</span>
                <p className="text-2xl font-black text-rose-400">${pieTotals.minTotal.toLocaleString('es-MX')}</p>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: SEGURIDAD */}
        {activeTab === 'seguridad' && role === 'Admin' && (
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl max-w-3xl mx-auto space-y-6">
            <h3 className="font-bold text-purple-400 mb-4">Configuración de Seguridad y Claves</h3>
            <form onSubmit={handleUpdatePins} className="grid grid-cols-3 gap-4 mb-4">
              <input type="text" placeholder="Nuevo PIN Admin" value={newAdminPin} onChange={e => setNewAdminPin(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <input type="text" placeholder="Nuevo PIN Tesorero" value={newTesoreroPin} onChange={e => setNewTesoreroPin(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <input type="text" placeholder="Nuevo PIN Visitante" value={newVisitantePin} onChange={e => setNewVisitantePin(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <button type="submit" className="col-span-3 py-2.5 bg-purple-600 font-bold rounded-xl text-xs text-white">Guardar Claves</button>
            </form>
            <div className="pt-4 border-t border-slate-800">
              <button onClick={() => setIsResetModalOpen(true)} className="w-full py-2.5 bg-rose-600/20 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs">🧹 Formatear Balanza {activeModule.toUpperCase()} ({fiscalYear}) a $0</button>
            </div>
          </div>
        )}

      </main>

      {/* MODAL RESET */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-rose-400">⚠️ Confirmar Formateo {activeModule.toUpperCase()}</h3>
            <form onSubmit={handleConfirmZeroReset} className="space-y-4">
              <input type="password" required placeholder="PIN Admin..." value={confirmPinModalInput} onChange={e => setConfirmPinModalInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100" />
              {modalError && <div className="text-rose-400 text-xs text-center">{modalError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
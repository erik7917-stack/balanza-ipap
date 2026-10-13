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
    const saved = localStorage.getItem('balanza_ipap_pins_v10');
    return saved ? JSON.parse(saved) : { Admin: '1234', Tesorero: '2222', Visitante: '0000' };
  });
  const [pinError, setPinError] = useState('');

  const [initialYearBalances, setInitialYearBalances] = useState(() => {
    const saved = localStorage.getItem('balanza_ipap_initial_balances_v10');
    return saved ? JSON.parse(saved) : { 
      diezmos: { '2025': 287220, '2026': 287220, '2027': 287220, '2028': 287220 }, 
      ofrendas: { '2025': 136504, '2026': 136504, '2027': 136504, '2028': 136504 } 
    };
  });

  const [cloudStatus, setCloudStatus] = useState("Conectando a Supabase...");
  const [toastMsg, setToastMsg] = useState('');
  
  const [activeModule, setActiveModule] = useState('diezmos');
  const [activeTab, setActiveTab] = useState('balanza');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(8); // Septiembre por defecto
  const [fiscalYear, setFiscalYear] = useState(() => localStorage.getItem('balanza_ipap_fiscal_year_v10') || '2026');

  const [budgetData, setBudgetData] = useState([]);
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('balanza_ipap_audit_logs_v10');
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
  const [customInitDiezmos, setCustomInitDiezmos] = useState('');
  const [customInitOfrendas, setCustomInitOfrendas] = useState('');
  const [secMsg, setSecMsg] = useState('');
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmPinModalInput, setConfirmPinModalInput] = useState('');
  const [modalError, setModalError] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

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

  useEffect(() => { localStorage.setItem('balanza_ipap_audit_logs_v10', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('balanza_ipap_fiscal_year_v10', fiscalYear); }, [fiscalYear]);
  useEffect(() => { localStorage.setItem('balanza_ipap_pins_v10', JSON.stringify(pins)); }, [pins]);
  useEffect(() => { localStorage.setItem('balanza_ipap_initial_balances_v10', JSON.stringify(initialYearBalances)); }, [initialYearBalances]);

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

  const handleLogout = () => {
    showToast("☁️ Sesión cerrada con éxito. Todos los cambios están respaldados de forma segura en la nube.");
    setTimeout(() => {
      setRole(null);
    }, 1200);
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
      fetchData();
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
          id: Date.now(), 
          deletedAt: new Date().toLocaleString('es-MX'),
          concept: target.concept, 
          extraData: target.extraData || '',
          amount: target.amount, 
          date: target.date, 
          module: target.module,
          year: target.year, 
          deletedBy: role
        };
        setAuditLogs([auditEntry, ...auditLogs]);
        showToast(`🗑️ "${target.concept}" eliminado correctamente y registrado en la bitácora.`);
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

  const handleUpdateAdminSettings = (e) => {
    e.preventDefault();
    const newP = { ...pins };
    if (newAdminPin.trim()) newP.Admin = newAdminPin.trim();
    if (newTesoreroPin.trim()) newP.Tesorero = newTesoreroPin.trim();
    if (newVisitantePin.trim()) newP.Visitante = newVisitantePin.trim();
    setPins(newP);

    const newInitB = { ...initialYearBalances };
    if (customInitDiezmos !== '') {
      newInitB.diezmos[fiscalYear] = parseFloat(customInitDiezmos) || 0;
    }
    if (customInitOfrendas !== '') {
      newInitB.ofrendas[fiscalYear] = parseFloat(customInitOfrendas) || 0;
    }
    setInitialYearBalances(newInitB);

    setNewAdminPin(''); setNewTesoreroPin(''); setNewVisitantePin('');
    setCustomInitDiezmos(''); setCustomInitOfrendas('');
    setSecMsg('¡Configuración de seguridad y saldos iniciales actualizada con éxito!');
    setTimeout(() => setSecMsg(''), 4000);
  };

  // Función para descargar la plantilla Excel de conceptos contables
  const handleDownloadConceptsExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,CLASIFICACION,CONCEPTO\n";
    INITIAL_EXPENSE_CONCEPTS.GASTOS_OPERACION.forEach(item => {
      csvContent += `GASTOS DE OPERACION,"${item}"\n`;
    });
    INITIAL_EXPENSE_CONCEPTS.GASTOS_MINISTERIOS.forEach(item => {
      csvContent += `GASTOS DE MINISTERIOS,"${item}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Plantilla_Conceptos_Gastos_IPAP_${fiscalYear}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("📥 ¡Plantilla de conceptos descargada con éxito!");
  };

  // Cálculo encadenado mes a mes con la corrección exacta de sumas iguales
  const calculateMonthTotalsForModule = (modName, targetMonthIdx) => {
    const baseInit = initialYearBalances[modName]?.[fiscalYear] !== undefined 
      ? initialYearBalances[modName][fiscalYear] 
      : (modName === 'diezmos' ? 287220 : 136504);

    const getPrevSaldoForMonth = (mIdx) => {
      let runningR = baseInit;
      for (let m = 0; m < mIdx; m++) {
        const mStr = String(m + 1).padStart(2, '0');
        const mRecs = budgetData.filter(i => i.module === modName && i.year === fiscalYear && i.date.split('-')[1] === mStr);
        let mIng = 0, mEgr = 0;
        mRecs.forEach(r => {
          if (r.type === 'Ingreso') mIng += Number(r.amount);
          if (r.type === 'Egreso') mEgr += Number(r.amount);
        });
        const mPresb = Math.round(mIng * 0.10);
        runningR = runningR + mIng - (mEgr + mPresb);
      }
      return runningR;
    };

    const initialSaldo = getPrevSaldoForMonth(targetMonthIdx);

    const monthNumStr = String(targetMonthIdx + 1).padStart(2, '0');
    const currentMonthRecs = budgetData.filter(i => i.module === modName && i.year === fiscalYear && i.date.split('-')[1] === monthNumStr);

    let totalIngresos = 0;
    let totalEgresosPuros = 0;
    currentMonthRecs.forEach(r => {
      if (r.type === 'Ingreso') totalIngresos += Number(r.amount);
      if (r.type === 'Egreso') totalEgresosPuros += Number(r.amount);
    });

    const presbiterio10 = Math.round(totalIngresos * 0.10);
    const totalEgresosConPresbiterio = totalEgresosPuros + presbiterio10;

    const saldoSiguienteMes = initialSaldo + totalIngresos - totalEgresosConPresbiterio;
    
    // SUMAS IGUALES: Ingresos Totales (Ingresos del mes + Saldo anterior)
    const sumasIguales = totalIngresos + initialSaldo;

    return {
      initialSaldo,
      totalIngresos,
      totalEgresos: totalEgresosPuros,
      presbiterio10,
      totalEgresosConPresbiterio,
      saldoSiguienteMes,
      sumasIguales
    };
  };

  const currentRecords = useMemo(() => {
    const monthNum = String(selectedMonthIdx + 1).padStart(2, '0');
    return budgetData.filter(i => i.module === activeModule && i.year === fiscalYear && i.date.split('-')[1] === monthNum)
                     .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [budgetData, activeModule, fiscalYear, selectedMonthIdx]);

  const monthTotals = useMemo(() => {
    return calculateMonthTotalsForModule(activeModule, selectedMonthIdx);
  }, [budgetData, activeModule, fiscalYear, selectedMonthIdx, initialYearBalances]);

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
        <div className="no-print fixed top-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-emerald-200">✕</button>
        </div>
      )}

      {/* HEADER OCULTO AL IMPRIMIR */}
      <header className="no-print bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-lg text-white">BALANZA DE ESTADOS {fiscalYear}</h1>
          <p className="text-xs text-slate-400">Control Contable IPAP</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400">{cloudStatus}</span>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-2xl">
            <span className="text-xs font-bold text-blue-300">Año:</span>
            <select value={fiscalYear} disabled={role !== 'Admin'} onChange={(e) => setFiscalYear(e.target.value)} className="bg-transparent text-amber-400 text-xs font-bold outline-none cursor-pointer">
              {FISCAL_YEARS.map(y => <option key={y} value={y} className="bg-slate-900 text-slate-100">{y}</option>)}
            </select>
          </div>
          <button onClick={handleLogout} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition">Salir</button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {role !== 'Visitante' && (
          <div className="no-print flex justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="flex gap-2">
              <button onClick={() => setActiveModule('diezmos')} className={`px-6 py-2.5 rounded-xl text-sm font-extrabold border transition ${activeModule === 'diezmos' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>📘 DIEZMOS</button>
              <button onClick={() => setActiveModule('ofrendas')} className={`px-6 py-2.5 rounded-xl text-sm font-extrabold border transition ${activeModule === 'ofrendas' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>📗 OFRENDAS</button>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Mes:</span>
              <select value={selectedMonthIdx} onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value))} className="bg-transparent text-xs font-bold text-amber-400 outline-none cursor-pointer">
                {MONTHS_FULL.map((m, i) => <option key={m} value={i} className="bg-slate-900">{m}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="no-print flex gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
          {role !== 'Visitante' && <button onClick={() => setActiveTab('balanza')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'balanza' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>📄 Balanza</button>}
          {role !== 'Visitante' && <button onClick={() => setActiveTab('captura')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'captura' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>✍️ Capturar</button>}
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'dashboard' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>📊 Dashboards</button>
          {role === 'Admin' && <button onClick={() => setActiveTab('seguridad')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'seguridad' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>⚙️ Seguridad</button>}
          
          {activeTab === 'balanza' && (
            <button onClick={() => window.print()} className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow">🖨️ Imprimir / PDF</button>
          )}
        </div>

        {/* VISTA: BALANZA */}
        {activeTab === 'balanza' && role !== 'Visitante' && (
          <div className="printable-balanza bg-white text-slate-900 rounded-3xl p-8 shadow-xl space-y-8">
            <div>
              <h2 className="text-2xl font-black uppercase text-center border-b-2 border-slate-900 pb-4 mb-2">
                TESORERÍA DE {activeModule}
              </h2>
              <p className="text-sm font-extrabold text-center uppercase tracking-widest text-slate-800">
                01 AL 31 DE {MONTHS_FULL[selectedMonthIdx]} DEL {fiscalYear}
              </p>
            </div>

            <table className="w-full text-sm text-left border-collapse border border-slate-900">
              <thead className="bg-slate-100 border-b-2 border-slate-900">
                <tr>
                  <th className="p-3 border-r border-slate-900">FECHA</th>
                  <th className="p-3 border-r border-slate-900">CONCEPTO</th>
                  <th className="p-3 text-right border-r border-slate-900">INGRESOS</th>
                  <th className="p-3 text-right border-r border-slate-900">EGRESOS</th>
                  <th className="p-3 text-right bg-slate-50 border-r border-slate-900">SALDO</th>
                  <th className="p-2 text-center no-print">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-bold border-b border-slate-300">
                  <td className="p-2.5 text-center border-r border-slate-300">-</td>
                  <td className="p-2.5 border-r border-slate-300">SALDO DEL MES ANTERIOR</td>
                  <td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 text-right bg-slate-100 border-r border-slate-300">${monthTotals.initialSaldo.toLocaleString('es-MX')}.00</td>
                  <td className="no-print"></td>
                </tr>

                {currentRecords.map(item => (
                  <tr key={item.id} className="border-b border-slate-300 hover:bg-slate-50">
                    <td className="p-2.5 border-r border-slate-300">{item.date}</td>
                    <td className="p-2.5 border-r border-slate-300 font-semibold">
                      {item.concept} {item.extraData && <span className="text-slate-500 italic">({item.extraData})</span>}
                    </td>
                    <td className="p-2.5 text-right font-bold text-emerald-800 border-r border-slate-300">
                      {item.type === 'Ingreso' ? `$${Number(item.amount).toLocaleString('es-MX')}.00` : ''}
                    </td>
                    <td className="p-2.5 text-right font-bold text-rose-800 border-r border-slate-300">
                      {item.type === 'Egreso' ? `$${Number(item.amount).toLocaleString('es-MX')}.00` : ''}
                    </td>
                    <td className="p-2.5 text-right font-bold border-r border-slate-300">
                      ${(monthTotals.initialSaldo + currentRecords.slice(0, currentRecords.indexOf(item) + 1).reduce((acc, cur) => cur.type === 'Ingreso' ? acc + Number(cur.amount) : acc - Number(cur.amount), 0)).toLocaleString('es-MX')}.00
                    </td>
                    <td className="p-1 text-center no-print border-l border-slate-300">
                      <button onClick={() => handleDeleteRecord(item.id)} className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg transition" title="Eliminar movimiento">🗑️</button>
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td className="p-2.5 border-r border-slate-300">FIN DE MES</td>
                  <td className="p-2.5 border-r border-slate-300">10% PRESBITERIO (AUTOMÁTICO)</td>
                  <td className="p-2.5 border-r border-slate-300"></td>
                  <td className="p-2.5 text-right text-rose-800 border-r border-slate-300">${monthTotals.presbiterio10.toLocaleString('es-MX')}.00</td>
                  <td className="p-2.5 text-right border-r border-slate-300">${monthTotals.saldoSiguienteMes.toLocaleString('es-MX')}.00</td>
                  <td className="no-print"></td>
                </tr>

                {/* SUMAS IGUALES CORREGIDAS EXACTAMENTE A LA PAR */}
                <tr className="bg-slate-200 font-black border-t-2 border-slate-900">
                  <td colSpan="2" className="p-3.5 text-right border-r border-slate-400">SUMAS IGUALES</td>
                  <td className="p-3.5 text-right border-r border-slate-400">${monthTotals.sumasIguales.toLocaleString('es-MX')}.00</td>
                  <td className="p-3.5 text-right border-r border-slate-400">${monthTotals.sumasIguales.toLocaleString('es-MX')}.00</td>
                  <td colSpan="2" className="bg-slate-100"></td>
                </tr>
              </tbody>
            </table>

            {/* LÍNEAS DE FIRMA */}
            <div className="signature-section pt-24 grid grid-cols-2 gap-16 text-center uppercase font-extrabold text-slate-900">
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs">TESORERÍA DE {activeModule.toUpperCase()}</p>
              </div>
              <div className="border-t-2 border-slate-900 pt-3">
                <p className="text-xs">PASTOR</p>
              </div>
            </div>
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
              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs text-white transition shadow">Guardar Registro en Supabase</button>
            </form>
          </div>
        )}

        {/* VISTA: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                <h3 className="font-bold text-slate-100 mb-6">Entradas vs Salidas Mensuales Consolidadas ({fiscalYear})</h3>
                <div className="flex h-48 items-end gap-2">
                  {consolidatedMonthlyData.map(d => {
                    const maxVal = Math.max(...consolidatedMonthlyData.map(x => Math.max(x.totalEntradas, x.totalSalidas)), 1);
                    return (
                      <div key={d.monthLabel} className="flex-1 flex flex-col items-center justify-end h-full group">
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
                <div className="flex flex-col sm:flex-row items-center gap-6 justify-around py-2">
                  {pieTotals.totalEgresosPure > 0 ? (
                    <svg viewBox="0 0 36 36" className="w-36 h-36 transform -rotate-90">
                      <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="5.5" strokeDasharray={`${pieTotals.pctOp} ${100 - pieTotals.pctOp}`} strokeDashoffset="0"></circle>
                      <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f43f5e" strokeWidth="5.5" strokeDasharray={`${pieTotals.pctMin} ${100 - pieTotals.pctMin}`} strokeDashoffset={`-${pieTotals.pctOp}`}></circle>
                    </svg>
                  ) : (
                    <div className="w-36 h-36 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs text-center p-2">
                      Sin egresos
                    </div>
                  )}
                  <div className="space-y-3 flex-1">
                    <div className="p-3 bg-amber-950/30 rounded-2xl border border-amber-500/30">
                      <span className="text-xs font-bold text-amber-400">Operación ({pieTotals.pctOp.toFixed(1)}%)</span>
                      <p className="text-xl font-black text-amber-400">${pieTotals.opTotal.toLocaleString('es-MX')}</p>
                    </div>
                    <div className="p-3 bg-rose-950/30 rounded-2xl border border-rose-500/30">
                      <span className="text-xs font-bold text-rose-400">Ministerios ({pieTotals.pctMin.toFixed(1)}%)</span>
                      <p className="text-xl font-black text-rose-400">${pieTotals.minTotal.toLocaleString('es-MX')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: SEGURIDAD (CON BOTÓN DE DESCARGA DE CONCEPTOS EXCLUSIVO ADMIN) */}
        {activeTab === 'seguridad' && role === 'Admin' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
              <div>
                <h3 className="font-bold text-purple-400 text-base">Configuración de Seguridad, Claves y Plantillas ({fiscalYear})</h3>
                <p className="text-xs text-slate-400">Gestión de PINs, saldos iniciales anuales y descarga de la plantilla oficial de conceptos contables.</p>
              </div>

              {secMsg && <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium text-center">{secMsg}</div>}

              {/* BOTÓN DE DESCARGA DE PLANTILLA DE CONCEPTOS */}
              <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-purple-300 uppercase">📥 Plantilla Oficial de Conceptos Contables</h4>
                  <p className="text-[11px] text-slate-400">Descarga en formato Excel/CSV la lista oficial de Gastos de Operación y Ministerios.</p>
                </div>
                <button
                  onClick={handleDownloadConceptsExcel}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition shadow"
                >
                  Descargar Conceptos
                </button>
              </div>

              <form onSubmit={handleUpdateAdminSettings} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">PIN Admin</label>
                    <input type="text" placeholder="Nuevo PIN Admin" value={newAdminPin} onChange={e => setNewAdminPin(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">PIN Tesorero</label>
                    <input type="text" placeholder="Nuevo PIN Tesorero" value={newTesoreroPin} onChange={e => setNewTesoreroPin(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">PIN Visitante</label>
                    <input type="text" placeholder="Nuevo PIN Visitante" value={newVisitantePin} onChange={e => setNewVisitantePin(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Saldo Inicial Diezmos ({fiscalYear})</label>
                    <input type="number" placeholder={initialYearBalances.diezmos[fiscalYear] || 287220} value={customInitDiezmos} onChange={e => setCustomInitDiezmos(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Saldo Inicial Ofrendas ({fiscalYear})</label>
                    <input type="number" placeholder={initialYearBalances.ofrendas[fiscalYear] || 136504} value={customInitOfrendas} onChange={e => setCustomInitOfrendas(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  </div>
                </div>

                <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-bold rounded-xl text-xs text-white transition">Guardar Configuración y Saldos</button>
              </form>

              <div className="pt-4 border-t border-slate-800">
                <button onClick={() => setIsResetModalOpen(true)} className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs transition">🧹 Formatear Balanza de {activeModule.toUpperCase()} ({fiscalYear}) a $0</button>
              </div>
            </div>

            {/* BITÁCORA DE AUDITORÍA */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-amber-400">📜 Bitácora de Auditoría (Movimientos Eliminados)</h3>
                <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-1 rounded-lg">{auditLogs.length} Registros</span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No hay registros de eliminaciones en este momento.</p>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-slate-800">Fecha Eliminación</th>
                        <th className="p-2 border-b border-slate-800">Módulo</th>
                        <th className="p-2 border-b border-slate-800">Concepto</th>
                        <th className="p-2 border-b border-slate-800 text-right">Monto</th>
                        <th className="p-2 border-b border-slate-800 text-center">Eliminado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-800/30">
                          <td className="p-2 text-slate-400">{log.deletedAt}</td>
                          <td className="p-2 uppercase font-bold text-blue-400">{log.module}</td>
                          <td className="p-2 text-slate-200">{log.concept} {log.extraData ? `(${log.extraData})` : ''}</td>
                          <td className="p-2 text-right text-rose-400">${Number(log.amount).toLocaleString('es-MX')}</td>
                          <td className="p-2 text-center text-amber-300 font-sans">{log.deletedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
              <input type="password" required placeholder="PIN Admin..." value={confirmPinModalInput} onChange={e => setConfirmPinModalInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100" />
              {modalError && <div className="text-rose-400 text-xs text-center">{modalError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESTILOS CSS EXCLUSIVOS PARA IMPRESIÓN LIMPIA Y FIRMAS */}
      <style>{`
        @media print {
          body { background: #ffffff !important; color: #000000 !important; }
          .no-print { display: none !important; }
          header, footer, nav { display: none !important; }
          .printable-balanza { background: #ffffff !important; color: #000000 !important; border: none !important; padding: 0 !important; box-shadow: none !important; }
          table { border-color: #000000 !important; background: #ffffff !important; width: 100% !important; }
          th, td { border-color: #333333 !important; color: #000000 !important; }
          .signature-section { display: grid !important; margin-top: 80px !important; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
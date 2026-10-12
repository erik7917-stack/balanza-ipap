import React, { useState, useEffect } from 'react';

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('balanza_ipap_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error al cargar datos guardados", e);
      }
    }
    return {
      items: [
        { id: 1, categoria: 'Ingresos', concepto: 'Aporte institucional', presupuesto: 50000, ejecutado: 45000 },
        { id: 2, categoria: 'Egresos', concepto: 'Gastos operativos', presupuesto: 20000, ejecutado: 18000 }
      ]
    };
  });

  const [statusMessage, setStatusMessage] = useState('Cambios guardados automáticamente');
  const [activeTab, setActiveTab] = useState('matriz');

  useEffect(() => {
    localStorage.setItem('balanza_ipap_data', JSON.stringify(data));
    setStatusMessage('Guardado en tiempo real');
  }, [data]);

  const handleManualSave = () => {
    localStorage.setItem('balanza_ipap_data', JSON.stringify(data));
    setStatusMessage('¡Guardado manual exitoso!');
    setTimeout(() => {
      setStatusMessage('Guardado en tiempo real');
    }, 3000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      {/* Cabecera Principal */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>Balanza de Estados IPAP</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#64748b' }}>Estado: <strong>{statusMessage}</strong></p>
        </div>
        <button 
          onClick={handleManualSave}
          style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          Guardar Cambios
        </button>
      </header>

      {/* Navegación por pestañas */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('matriz')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'matriz' ? '#1e293b' : '#e2e8f0', color: activeTab === 'matriz' ? 'white' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Matriz Presupuestal General
        </button>
      </div>

      {/* Contenido de la vista */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', color: '#334155', marginTop: 0 }}>Matriz Presupuestal General</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Aquí puedes visualizar y controlar los movimientos presupuestales de manera unificada.</p>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px', color: '#475569' }}>Categoría</th>
              <th style={{ padding: '12px', color: '#475569' }}>Concepto</th>
              <th style={{ padding: '12px', color: '#475569' }}>Presupuesto</th>
              <th style={{ padding: '12px', color: '#475569' }}>Ejecutado</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', color: '#1e293b' }}>{item.categoria}</td>
                <td style={{ padding: '12px', color: '#1e293b' }}>{item.concepto}</td>
                <td style={{ padding: '12px', color: '#1e293b' }}>${item.presupuesto.toLocaleString()}</td>
                <td style={{ padding: '12px', color: '#1e293b' }}>${item.ejecutado.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
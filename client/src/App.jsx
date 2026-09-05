import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CustomerAuthProvider, useCustomerAuth } from './context/CustomerAuthContext';
import LandingPage from './pages/LandingPage';
import MerchantApp from './pages/MerchantApp';
import Login from './pages/Login';
import CustomerApp from './pages/CustomerApp';
import CustomerLogin from './pages/CustomerLogin';

// 'landing' | 'merchant-login' | 'merchant-app' | 'customer-login' | 'customer-app'

function RootApp() {
  const { merchant, loading: merchantLoading } = useAuth();
  const { customer, loading: customerLoading } = useCustomerAuth();

  const [role, setRole] = useState(() => {
    // Restore role from sessionStorage so refreshes feel seamless
    return sessionStorage.getItem('razoragent_role') || 'landing';
  });

  // If merchant is already logged in on refresh, go straight to merchant app
  useEffect(() => {
    if (!merchantLoading && !customerLoading) {
      if (merchant && role === 'landing') {
        setRole('merchant-app');
      } else if (customer && role === 'landing') {
        setRole('customer-app');
      }
    }
  }, [merchantLoading, customerLoading, merchant, customer]);

  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    sessionStorage.setItem('razoragent_role', newRole);
  };

  if (merchantLoading || customerLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-500">Initializing RazorAgent...</span>
        </div>
      </div>
    );
  }

  // If merchant logged in, always show merchant app (unless explicitly going to landing)
  if (merchant && role !== 'landing' && role !== 'customer-login' && role !== 'customer-app') {
    return <MerchantApp onSwitchRole={handleRoleSwitch} />;
  }

  // If customer logged in, always show customer app (unless going to landing)
  if (customer && role !== 'landing' && role !== 'merchant-login' && role !== 'merchant-app') {
    return <CustomerApp onSwitchRole={handleRoleSwitch} />;
  }

  switch (role) {
    case 'merchant-login':
      return (
        <div className="min-h-screen bg-slate-950">
          <Login
            setActiveTab={(tab) => {
              if (tab === 'overview') {
                handleRoleSwitch('merchant-app');
              }
            }}
            onBack={() => handleRoleSwitch('landing')}
          />
        </div>
      );

    case 'merchant-app':
      return merchant
        ? <MerchantApp onSwitchRole={handleRoleSwitch} />
        : <Login
            setActiveTab={(tab) => { if (tab === 'overview') handleRoleSwitch('merchant-app'); }}
            onBack={() => handleRoleSwitch('landing')}
          />;

    case 'customer-login':
      return (
        <CustomerLogin
          onBack={() => handleRoleSwitch('landing')}
          onSuccess={() => handleRoleSwitch('customer-app')}
        />
      );

    case 'customer-app':
      return customer
        ? <CustomerApp onSwitchRole={handleRoleSwitch} />
        : <CustomerLogin
            onBack={() => handleRoleSwitch('landing')}
            onSuccess={() => handleRoleSwitch('customer-app')}
          />;

    case 'landing':
    default:
      return (
        <LandingPage
          onSelectRole={(selectedRole) => {
            if (selectedRole === 'merchant') {
              handleRoleSwitch(merchant ? 'merchant-app' : 'merchant-login');
            } else {
              handleRoleSwitch(customer ? 'customer-app' : 'customer-login');
            }
          }}
        />
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <CustomerAuthProvider>
        <RootApp />
      </CustomerAuthProvider>
    </AuthProvider>
  );
}

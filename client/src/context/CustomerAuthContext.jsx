import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore from localStorage on mount
    const token = localStorage.getItem('razoragent_customer_token');
    const profile = localStorage.getItem('razoragent_customer_profile');
    if (token && profile) {
      try {
        setCustomer(JSON.parse(profile));
      } catch {
        localStorage.removeItem('razoragent_customer_token');
        localStorage.removeItem('razoragent_customer_profile');
      }
    }
    setLoading(false);
  }, []);

  const customerRegister = async (userData) => {
    const res = await api.post('/api/auth/customer/register', userData);
    if (res.data?.token) {
      localStorage.setItem('razoragent_customer_token', res.data.token);
      localStorage.setItem('razoragent_customer_profile', JSON.stringify(res.data.customer));
      setCustomer(res.data.customer);
      return res.data;
    }
    throw new Error('Registration failed');
  };

  const customerLogin = async (email, password) => {
    const res = await api.post('/api/auth/customer/login', { email, password });
    if (res.data?.token) {
      localStorage.setItem('razoragent_customer_token', res.data.token);
      localStorage.setItem('razoragent_customer_profile', JSON.stringify(res.data.customer));
      setCustomer(res.data.customer);
      return res.data;
    }
    throw new Error('Login failed');
  };

  const customerLogout = () => {
    localStorage.removeItem('razoragent_customer_token');
    localStorage.removeItem('razoragent_customer_profile');
    setCustomer(null);
  };

  const getCustomerToken = () => localStorage.getItem('razoragent_customer_token');

  return (
    <CustomerAuthContext.Provider value={{
      customer, loading,
      customerLogin, customerRegister, customerLogout, getCustomerToken
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);

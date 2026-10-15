import React from 'react'; import {createRoot} from 'react-dom/client'; import AdminApp from './AdminApp'; import './style.css';
const root=document.getElementById('root'); if(!root) throw new Error('Missing root'); createRoot(root).render(<React.StrictMode><AdminApp/></React.StrictMode>);

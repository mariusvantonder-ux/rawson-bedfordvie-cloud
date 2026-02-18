<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Rawson Properties - Agent Tracker</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #FFD700;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 10px;
        }

        @media (min-width: 768px) {
            .container {
                max-width: 1200px;
                padding: 20px;
            }
        }

        /* Login Screen */
        #loginScreen {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .login-box {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 40px 30px;
            width: 100%;
            max-width: 400px;
        }

        .login-logo {
            max-width: 250px;
            margin: 0 auto 30px;
            display: block;
        }

        .login-box h1 {
            text-align: center;
            color: #000;
            margin-bottom: 30px;
            font-size: 24px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }

        .form-group input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
        }

        .form-group input:focus {
            outline: none;
            border-color: #FFD700;
        }

        .btn {
            width: 100%;
            padding: 14px;
            background: #000;
            color: #FFD700;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn:active {
            transform: scale(0.98);
        }

        .error-message {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }

        /* App Header */
        .app-header {
            background: #000;
            color: #FFD700;
            padding: 15px;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .app-header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
        }

        .app-title {
            font-size: 18px;
            font-weight: 700;
        }

        .user-info {
            font-size: 14px;
        }

        .btn-logout {
            background: #FFD700;
            color: #000;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            margin-left: 15px;
        }

        /* Tabs */
        .tabs {
            display: flex;
            background: white;
            border-radius: 12px;
            padding: 5px;
            margin: 15px 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        .tab {
            flex: 1;
            padding: 12px 20px;
            text-align: center;
            border: none;
            background: transparent;
            cursor: pointer;
            font-weight: 600;
            color: #666;
            border-radius: 8px;
            white-space: nowrap;
            transition: all 0.3s;
        }

        .tab.active {
            background: #000;
            color: #FFD700;
        }

        /* Cards */
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .card h2 {
            color: #000;
            margin-bottom: 15px;
            font-size: 20px;
        }

        .card h3 {
            color: #333;
            margin-bottom: 12px;
            font-size: 16px;
        }

        /* Commission Goal */
        .commission-goal {
            background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 15px;
        }

        .commission-input-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 15px 0;
        }

        .commission-input {
            flex: 1;
            padding: 12px 15px;
            border: 2px solid rgba(255,255,255,0.3);
            background: rgba(255,255,255,0.1);
            color: white;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
        }

        .commission-display {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }

        .commission-stat {
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 8px;
        }

        /* Activities */
        .activity-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .activity-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .activity-name {
            font-weight: 600;
            color: #333;
        }

        .activity-input-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .activity-input {
            flex: 1;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
        }

        .btn-small {
            padding: 10px 20px;
            background: #000;
            color: #FFD700;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .app-title {
                font-size: 14px;
            }
            
            .user-info {
                font-size: 12px;
            }
            
            .btn-logout {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .commission-display {
                grid-template-columns: 1fr;
            }
        }

        /* Loading Spinner */
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #000;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none !important;
        }

        /* Success Message */
        .success-message {
            background: #d4edda;
            color: #155724;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <!-- Login Screen -->
    <div id="loginScreen">
        <div class="login-box">
            <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." class="login-logo" alt="Rawson Properties">
            <h1>Agent Tracker Login</h1>
            <div id="loginError" class="error-message"></div>
            <form id="loginForm">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password">
                </div>
                <button type="submit" class="btn">Login</button>
            </form>
        </div>
    </div>

    <!-- Main App (Hidden until login) -->
    <div id="appScreen" class="hidden">
        <div class="app-header">
            <div class="app-header-content">
                <div class="app-title">🏢 Rawson Properties</div>
                <div>
                    <span class="user-info" id="userDisplay"></span>
                    <button class="btn-logout" onclick="logout()">Logout</button>
                </div>
            </div>
        </div>

        <div class="container">
            <!-- Main Content Area -->
            <div id="mainContent">
                <div class="spinner"></div>
            </div>
        </div>
    </div>

    <script>
        const API_URL = window.location.origin + '/api';
        let currentUser = null;
        let authToken = null;

        // Check for saved token on load
        window.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                authToken = token;
                loadUserData();
            }
        });

        // Login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (!response.ok) {
                    throw new Error('Invalid credentials');
                }

                const data = await response.json();
                authToken = data.token;
                currentUser = data.user;
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                showApp();
            } catch (error) {
                document.getElementById('loginError').textContent = 'Invalid username or password';
                document.getElementById('loginError').style.display = 'block';
            }
        });

        async function loadUserData() {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (!response.ok) {
                    throw new Error('Session expired');
                }

                currentUser = await response.json();
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showApp();
            } catch (error) {
                logout();
            }
        }

        function showApp() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.remove('hidden');
            document.getElementById('userDisplay').textContent = currentUser.full_name;
            
            loadDashboard();
        }

        function logout() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            authToken = null;
            currentUser = null;
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('appScreen').classList.add('hidden');
            document.getElementById('loginForm').reset();
        }

        async function loadDashboard() {
            const content = document.getElementById('mainContent');
            
            try {
                const response = await fetch(`${API_URL}/dashboard`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                const data = await response.json();
                
                if (currentUser.role === 'agent') {
                    renderAgentDashboard(data);
                } else {
                    renderAdminDashboard(data);
                }
            } catch (error) {
                content.innerHTML = '<div class="card"><p>Error loading dashboard. Please try again.</p></div>';
            }
        }

        function renderAgentDashboard(data) {
            const currentYear = new Date().getFullYear();
            const content = document.getElementById('mainContent');
            
            content.innerHTML = `
                <div class="commission-goal">
                    <h2>💰 Gross Commission Target ${currentYear}</h2>
                    <div class="commission-input-group">
                        <span style="font-size: 20px; font-weight: 700;">R</span>
                        <input type="number" id="annualTarget" class="commission-input" 
                               value="${data.commissionGoal?.annual_target || 0}" 
                               placeholder="Enter annual target"
                               onchange="saveCommissionGoal()">
                    </div>
                    <div class="commission-display">
                        <div class="commission-stat">
                            <div style="font-size: 12px; opacity: 0.9;">Quarterly Target</div>
                            <div style="font-size: 24px; font-weight: 700;">R <span id="quarterlyTarget">0</span></div>
                        </div>
                        <div class="commission-stat">
                            <div style="font-size: 12px; opacity: 0.9;">Monthly Target</div>
                            <div style="font-size: 24px; font-weight: 700;">R <span id="monthlyTarget">0</span></div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2>📊 My Dashboard</h2>
                    <p>Welcome, ${currentUser.full_name}!</p>
                    <p>Total Commission ${currentYear}: R ${(data.totalCommission?.total || 0).toLocaleString()}</p>
                </div>

                <div class="tabs">
                    <button class="tab active" onclick="showTab('goals')">Monthly Goals</button>
                    <button class="tab" onclick="showTab('activities')">Weekly Activities</button>
                    <button class="tab" onclick="showTab('commission')">Commission</button>
                </div>

                <div id="tabContent"></div>
            `;
            
            calculateCommissionTargets();
            showTab('goals');
        }

        function renderAdminDashboard(data) {
            const content = document.getElementById('mainContent');
            
            content.innerHTML = `
                <div class="card">
                    <h2>🏢 Office Overview</h2>
                    <p>Total Agents: ${data.agents.length}</p>
                </div>

                <div class="tabs">
                    <button class="tab active" onclick="showTab('overview')">Overview</button>
                    <button class="tab" onclick="showTab('agents')">Manage Agents</button>
                    <button class="tab" onclick="showTab('reports')">Reports</button>
                </div>

                <div id="tabContent"></div>
            `;
            
            showTab('overview');
        }

        function calculateCommissionTargets() {
            const annual = parseFloat(document.getElementById('annualTarget')?.value || 0);
            const quarterly = Math.round(annual / 4);
            const monthly = Math.round(annual / 12);
            
            if (document.getElementById('quarterlyTarget')) {
                document.getElementById('quarterlyTarget').textContent = quarterly.toLocaleString();
            }
            if (document.getElementById('monthlyTarget')) {
                document.getElementById('monthlyTarget').textContent = monthly.toLocaleString();
            }
        }

        async function saveCommissionGoal() {
            const annual = parseFloat(document.getElementById('annualTarget').value || 0);
            const year = new Date().getFullYear();
            
            try {
                await fetch(`${API_URL}/commission-goals`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ year, annual_target: annual })
                });
                
                calculateCommissionTargets();
                showSuccessMessage('Commission goal saved!');
            } catch (error) {
                alert('Failed to save commission goal');
            }
        }

        function showTab(tab) {
            // Implement tab content loading here
            const tabContent = document.getElementById('tabContent');
            tabContent.innerHTML = `<div class="card"><p>Loading ${tab}...</p></div>`;
            
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
        }

        function showSuccessMessage(message) {
            const msg = document.createElement('div');
            msg.className = 'success-message';
            msg.textContent = message;
            document.getElementById('mainContent').prepend(msg);
            setTimeout(() => msg.remove(), 3000);
        }
    </script>
</body>
</html>

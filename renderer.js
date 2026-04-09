// App interaction logic
const { ipcRenderer } = require('electron');
const { initializeApp } = require('firebase/app');
const { getAnalytics } = require('firebase/analytics');
const { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, setDoc, getDoc, serverTimestamp, where } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMvlRvq2ARQUZrkseWB9JrmSo_YPvA04s",
  authDomain: "poll-ff2a0.firebaseapp.com",
  projectId: "poll-ff2a0",
  storageBucket: "poll-ff2a0.firebasestorage.app",
  messagingSenderId: "876538043536",
  appId: "1:876538043536:web:a513042e7b55b1a2774c15",
  measurementId: "G-NGJK8YM1LP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // ... Window & Sidebar logic ...
    const minBtn = document.getElementById('minimize-btn');
    const maxBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minBtn) minBtn.addEventListener('click', () => ipcRenderer.send('window-minimize'));
    if (maxBtn) maxBtn.addEventListener('click', () => ipcRenderer.send('window-maximize'));
    if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('window-close'));

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }

    // ... Navigation ...
    const navOverview = document.getElementById('nav-overview');
    const navFeatures = document.getElementById('nav-features');
    const navTodo = document.getElementById('nav-todo');
    const navPrefs = document.getElementById('nav-prefs');

    const landingView = document.getElementById('landing-view');
    const blankView = document.getElementById('blank-view');
    const todoView = document.getElementById('todo-view');
    const prefView = document.getElementById('pref-view');
    
    const staticBg = document.querySelector('.static-bg');

    function switchView(activeNav, activeView) {
        // Clear all active states
        [navOverview, navFeatures, navTodo].forEach(nav => nav?.classList.remove('active'));
        [landingView, blankView, todoView, prefView].forEach(view => { if (view) view.style.display = 'none'; });
        
        if (activeNav) activeNav.classList.add('active');
        if (activeView) activeView.style.display = 'block';

        // Background Grid Logic: Only show on Overview
        if (staticBg) {
            if (activeView === landingView) {
                staticBg.classList.remove('hide-grid');
            } else {
                staticBg.classList.add('hide-grid');
            }
        }
    }

    if (navOverview) navOverview.addEventListener('click', () => switchView(navOverview, landingView));
    if (navFeatures) navFeatures.addEventListener('click', () => switchView(navFeatures, blankView));
    if (navTodo) navTodo.addEventListener('click', () => switchView(navTodo, todoView));
    if (navPrefs) navPrefs.addEventListener('click', () => switchView(null, prefView));

    // --- Collaborative To-Do Logic ---
    const todoListContainer = document.getElementById('todo-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const todoModal = document.getElementById('todo-modal');
    const openModalBtn = document.getElementById('open-todo-btn');
    const closeModalBtn = document.getElementById('close-todo-modal');
    const modalTitle = todoModal.querySelector('.modal-header h3');

    let editingTaskId = null; // Track if we are editing or adding new
    
    // Modal Toggles
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            editingTaskId = null;
            modalTitle.innerText = "NEW TASK";
            addTaskBtn.innerText = "CREATE TASK";
            clearInputs();
            todoModal.style.display = 'flex';
        });
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => todoModal.style.display = 'none');
    
    // Inputs
    const inputName = document.getElementById('todo-name');
    const inputOwner = document.getElementById('todo-owner');
    const inputFor = document.getElementById('todo-for');
    const inputDesc = document.getElementById('todo-desc');
    const inputDue = document.getElementById('todo-due');

    function clearInputs() {
        [inputName, inputOwner, inputFor, inputDesc, inputDue].forEach(el => el.value = '');
        if (inputDesc) {
            inputDesc.style.height = 'auto';
        }
    }

    if (inputDesc) {
        inputDesc.addEventListener('input', () => {
            inputDesc.style.height = 'auto';
            inputDesc.style.height = (inputDesc.scrollHeight) + 'px';
        });
    }

    // Add or Update Task
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const taskName = inputName.value.trim();
            if (!taskName) return alert('Please enter a task name.');

            const taskData = {
                name: taskName,
                owner: inputOwner.value || "Anonymous",
                for: inputFor.value || "Anyone",
                description: inputDesc.value,
                dueDate: inputDue.value || "No date",
                completed: false
            };

            try {
                if (editingTaskId) {
                    // Update existing
                    const taskRef = doc(db, "tasks", editingTaskId);
                    await updateDoc(taskRef, taskData);
                } else {
                    // Add new
                    taskData.createdAt = serverTimestamp();
                    await addDoc(collection(db, "tasks"), taskData);
                }
                todoModal.style.display = 'none';
                clearInputs();
            } catch (e) {
                console.error("Error saving task: ", e);
            }
        });
    }

    // Sync Tasks Real-time (Simplified query to avoid index/missing field issues)
    const q = collection(db, "tasks");
    onSnapshot(q, (snapshot) => {
        console.log("Firestore sync update received. Document count:", snapshot.size);
        todoListContainer.innerHTML = '';
        
        // Manual sort: Active first, then by date (if available)
        const sortedDocs = snapshot.docs.sort((a, b) => {
            const taskA = a.data();
            const taskB = b.data();
            if (taskA.completed !== taskB.completed) {
                return taskA.completed ? 1 : -1;
            }
            return (taskB.createdAt?.seconds || 0) - (taskA.createdAt?.seconds || 0);
        });

        sortedDocs.forEach((docSnap) => {
            const task = docSnap.data();
            const id = docSnap.id;
            const row = document.createElement('div');
            row.className = `todo-row ${task.completed ? 'task-completed' : ''}`;
            
            row.innerHTML = `
                <div class="grid-cell grid-col-check">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                </div>
                <div class="grid-cell grid-col-name">${task.name}</div>
                <div class="grid-cell grid-col-desc">${task.description || "-"}</div>
                <div class="grid-cell grid-col-for">${task.for}</div>
                <div class="grid-cell grid-col-owner">${task.owner}</div>
                <div class="grid-cell grid-col-due">${task.dueDate}</div>
                <div class="grid-cell grid-col-actions">
                    ${!task.completed ? `
                        <button class="action-btn update-btn" title="Update Task">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    ` : `
                        <button class="action-btn delete-btn" title="Delete Task">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    `}
                </div>
            `;

            // Toggle Completion
            row.querySelector('.task-checkbox').addEventListener('change', async (e) => {
                await updateDoc(doc(db, "tasks", id), { completed: e.target.checked });
            });

            // Update Handler
            const upBtn = row.querySelector('.update-btn');
            if (upBtn) {
                upBtn.addEventListener('click', () => {
                    editingTaskId = id;
                    modalTitle.innerText = "EDIT TASK";
                    addTaskBtn.innerText = "SAVE CHANGES";
                    inputName.value = task.name;
                    inputOwner.value = task.owner;
                    inputFor.value = task.for;
                    inputDesc.value = task.description;
                    inputDue.value = task.dueDate;
                    todoModal.style.display = 'flex';
                });
            }

            // Delete Handler
            const delBtn = row.querySelector('.delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to delete this task?")) {
                        await deleteDoc(doc(db, "tasks", id));
                    }
                });
            }

            todoListContainer.appendChild(row);
        });
    });

    // --- Auth & Onboarding Logic ---
    const signInBtn = document.getElementById('sign-in-btn');
    const profileTrigger = document.getElementById('profile-trigger');
    const userDisplayName = document.getElementById('user-display-name');
    const loginOverlay = document.getElementById('login-overlay');
    const loginNameInput = document.getElementById('login-name-input');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const logoutBtn = document.getElementById('logout-btn');

    function updateAuthUI() {
        const userName = localStorage.getItem('userName');
        if (userName) {
            signInBtn.style.display = 'none';
            profileTrigger.style.display = 'flex';
            userDisplayName.innerText = userName.toUpperCase();
            loginOverlay.style.display = 'none';
            // Pre-fill To-Do form
            if (inputOwner) inputOwner.value = userName;
        } else {
            signInBtn.style.display = 'block';
            profileTrigger.style.display = 'none';
        }
    }

    if (signInBtn) signInBtn.addEventListener('click', () => {
        loginOverlay.style.display = 'flex';
        loginNameInput.focus();
    });

    if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', () => {
        const name = loginNameInput.value.trim();
        if (name) {
            localStorage.setItem('userName', name);
            updateAuthUI();
            updatePresence(); // Sync name change instantly
        } else {
            loginNameInput.placeholder = "NAME REQUIRED PLEASE";
            loginNameInput.style.borderBottomColor = "red";
            setTimeout(() => {
                loginNameInput.placeholder = "ENTER YOUR FULL NAME";
                loginNameInput.style.borderBottomColor = "#000000";
            }, 2000);
            loginNameInput.focus();
        }
    });

    // Handle 'Enter' key in login input
    if (loginNameInput) {
        loginNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginSubmitBtn.click();
        });
    }

    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userName');
        updateAuthUI();
        updatePresence(); // Sync logout instantly
    });

    // Profile Dropdown Toggle
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!profileTrigger.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
    }

    // --- Theme System Logic ---
    const themeGrid = document.querySelector('.theme-grid');
    const themeSwatches = document.querySelectorAll('.theme-swatch');

    function applyTheme(themeName) {
        // Remove all theme classes from body
        document.body.classList.remove('theme-blue', 'theme-green', 'theme-pink', 'theme-purple', 'theme-white');
        
        // Add the specific theme class
        document.body.classList.add(`theme-${themeName}`);

        // Update swatch active state
        document.querySelectorAll('.theme-swatch').forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.theme === themeName);
        });

        localStorage.setItem('appTheme', themeName);
    }

    if (themeGrid) {
        themeGrid.addEventListener('click', (e) => {
            const swatch = e.target.closest('.theme-swatch');
            if (swatch) {
                applyTheme(swatch.dataset.theme);
            }
        });
    }

    // --- Real-Time Users Online Logic ---
    const usersListContainer = document.getElementById('users-list');
    const sessionID = Math.random().toString(36).substring(2, 8).toUpperCase();

    async function updatePresence(status = 'online') {
        const userName = localStorage.getItem('userName') || 'GUEST';
        try {
            await setDoc(doc(db, "presence", sessionID), {
                name: userName,
                sessionID: sessionID,
                status: status,
                lastActive: serverTimestamp()
            });
        } catch (e) {
            console.error("Error updating presence:", e);
        }
    }

    // Handle closing the app: instantly set to offline
    window.addEventListener('beforeunload', () => {
        // We use a simplified update here to try and get it out before the process dies
        updatePresence('offline');
    });

    // Listen for all active sessions
    onSnapshot(query(collection(db, "presence")), (snapshot) => {
        if (!usersListContainer) return;
        usersListContainer.innerHTML = '';
        
        const sessions = [];
        snapshot.forEach(doc => sessions.push(doc.data()));

        const now = Date.now();
        const activeThreshold = 5 * 60 * 1000; // 5 mins for online heartbeat
        const offlineThreshold = 10 * 60 * 1000; // 10 mins for offline ghosting

        sessions.sort((a, b) => a.name.localeCompare(b.name)).forEach(session => {
            const lastActive = session.lastActive?.toDate();
            if (!lastActive) return;

            const timeDiff = now - lastActive.getTime();
            let isVisible = false;
            let statusClass = '';

            // Logic:
            // 1. If it's US, always show online (green)
            // 2. If status is online and within 5 mins, show green
            // 3. If status is offline and within 10 mins, show grey
            if (session.sessionID === sessionID) {
                isVisible = true;
                statusClass = ''; // Green
            } else if (session.status === 'offline') {
                if (timeDiff < offlineThreshold) {
                    isVisible = true;
                    statusClass = 'offline';
                }
            } else {
                // Online or unknown status
                if (timeDiff < activeThreshold) {
                    isVisible = true;
                    statusClass = '';
                }
            }

            if (isVisible) {
                const row = document.createElement('div');
                row.className = 'user-row';
                row.innerHTML = `
                    <div class="user-status-cell"><div class="online-dot ${statusClass}"></div></div>
                    <div class="user-name-cell">${session.name}</div>
                    <div class="user-id-cell">#${session.sessionID}</div>
                `;
                usersListContainer.appendChild(row);
            }
        });
    });

    // Initial Presence
    updatePresence();
    // Heartbeat every 2 minutes
    setInterval(() => updatePresence('online'), 120000);

    // Initialize Auth & Theme
    updateAuthUI();
    const savedTheme = localStorage.getItem('appTheme') || 'blue';
    applyTheme(savedTheme);

    console.log('App successfully initialized');
});

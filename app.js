/* ==========================================================================
   ESCALA JORNADAS - APP LOGIC (CÉREBRO DO SISTEMA)
   Workforce Management System - Hospital Albert Einstein WFM Core
   ========================================================================== */

(function () {
  // --- ESTADO GLOBAL DA APLICAÇÃO ---
  const state = {
    currentTab: 'dashboard',
    currentYear: 2026,
    currentMonth: 4, // Maio (0-indexed: Janeiro = 0, Maio = 4)
    todayStr: '2026-05-26', // Alinhado com a data local fornecida
    employees: [],
    shifts: {}, // Formato: { employeeId: { "YYYY-MM-DD": "M" } }
    activeSector: 'UTI Adulto',
    selectedCell: null, // Guardará { employeeId, dateStr } quando for editar plantão
    
    // Perfil de Acesso Ativo
    currentUser: {
      role: 'admin',
      name: 'Administrador',
      id: 'admin'
    }
  };

  // --- DICIONÁRIOS E CONFIGURAÇÕES ---
  const MONTHS_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Dados iniciais de semente (Seeding)
  const DEFAULT_EMPLOYEES = [
    { id: "emp-1", name: "Dr. Lucas Mendes", role: "Médico Intensivista", sector: "UTI Adulto", scale: "12x36", email: "lucas.mendes@einstein.org.br" },
    { id: "emp-2", name: "Mariana Souza", role: "Enfermeira Chefe", sector: "UTI Adulto", scale: "5x2", email: "mariana.souza@einstein.org.br" },
    { id: "emp-3", name: "Roberto Silva", role: "Técnico de Enfermagem", sector: "UTI Adulto", scale: "12x36", email: "roberto.silva@einstein.org.br" },
    { id: "emp-4", name: "Juliana Cruz", role: "Técnica de Enfermagem", sector: "UTI Adulto", scale: "12x36", email: "juliana.cruz@einstein.org.br" },
    { id: "emp-5", name: "Carlos Rocha", role: "Enfermeiro Supervisor", sector: "Pronto Socorro", scale: "12x36", email: "carlos.rocha@einstein.org.br" },
    { id: "emp-6", name: "Amanda Costa", role: "Técnica de Enfermagem", sector: "Pronto Socorro", scale: "6x1", email: "amanda.costa@einstein.org.br" },
    { id: "emp-7", name: "Patrícia Melo", role: "Técnica de Enfermagem", sector: "Pronto Socorro", scale: "6x1", email: "patricia.melo@einstein.org.br" },
    { id: "emp-8", name: "Marcos Dias", role: "Técnico de Enfermagem", sector: "Enfermaria Geral", scale: "6x1", email: "marcos.dias@einstein.org.br" },
    { id: "emp-9", name: "Sandra Santos", role: "Assistente Administrativo", sector: "Administrativo", scale: "5x2", email: "sandra.santos@einstein.org.br" },
    { id: "emp-10", name: "Bruno Ramos", role: "Técnico de Enfermagem", sector: "UTI Adulto", scale: "6x1", email: "bruno.ramos@einstein.org.br" }
  ];

  // --- INICIALIZAÇÃO DA APLICAÇÃO ---
  function init() {
    loadData();
    setupNavigation();
    setupEventListeners();
    
    // Configurar campos de cadastro dinâmicos para lançamento de colaborador
    populateSectorOptionsInForm();
    populateSectorFilters();
    
    // Verificar sessão de login ativa
    checkLoginSession();
    
    // Renderizações Iniciais se logado
    if (state.currentUser) {
      renderAll();
    }
  }

  // --- CONTROLE DE SESSÃO & LOGIN ---
  function checkLoginSession() {
    const session = sessionStorage.getItem('ej_session');
    const modalLogin = document.getElementById('modal-login');
    
    if (session) {
      state.currentUser = JSON.parse(session);
      if (modalLogin) modalLogin.classList.remove('active');
      updateSidebarUserProfile();
      applyAccessControlPolicies();
    } else {
      state.currentUser = null;
      if (modalLogin) modalLogin.classList.add('active');
    }
  }

  function handleLoginSubmit() {
    const profile = document.getElementById('login-profile').value;
    const passwordInput = document.getElementById('login-password');
    const password = passwordInput.value.trim();
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');

    // Validar senha (exigida 123456 para Admin, Enfermeiro e Técnico conforme solicitação)
    if (password !== '123456') {
      if (errorAlert) {
        errorAlert.style.display = 'flex';
        if (errorText) errorText.textContent = "Senha incorreta. Por favor, insira a senha padrão: 123456.";
      }
      return;
    }

    if (errorAlert) errorAlert.style.display = 'none';

    // Definir Usuário
    let name = 'Administrador';
    let id = 'admin';
    
    if (profile === 'enfermeiro') {
      name = 'Mariana Souza (Enf. Chefe)';
      id = 'emp-2'; // Vinculada à Enfermeira Chefe do UTI
    } else if (profile === 'tecnico') {
      name = 'Roberto Silva (Téc. Enfermagem)';
      id = 'emp-3'; // Vinculado ao Técnico de Enfermagem do UTI
    }

    state.currentUser = { role: profile, name, id };
    sessionStorage.setItem('ej_session', JSON.stringify(state.currentUser));

    // Limpar campo de senha
    passwordInput.value = '';

    // Fechar modal
    closeModal('modal-login');

    // Inicializar UI
    updateSidebarUserProfile();
    applyAccessControlPolicies();
    
    // Se logou como técnico, forçar aba escala
    if (profile === 'tecnico') {
      switchTab('escala');
    } else {
      switchTab('dashboard');
    }
    
    renderAll();
    showToast(`Bem-vindo, ${name}! Nível de acesso: ${profile.toUpperCase()}.`, "success");
  }

  function handleLogout() {
    if (confirm("Deseja realmente sair do sistema e trocar de usuário?")) {
      sessionStorage.removeItem('ej_session');
      state.currentUser = null;
      
      // Limpar campos de senha e erro do modal
      document.getElementById('login-password').value = '';
      document.getElementById('login-error-alert').style.display = 'none';
      
      openModal('modal-login');
      showToast("Você foi desconectado.", "info");
    }
  }

  // --- ATUALIZAR INTERFACE SEGUNDO PERFIL ---
  function updateSidebarUserProfile() {
    const avatar = document.getElementById('sidebar-user-avatar');
    const name = document.getElementById('sidebar-user-name');
    const role = document.getElementById('sidebar-user-role');

    if (!state.currentUser) return;

    name.textContent = state.currentUser.name.split(' (')[0];
    
    if (state.currentUser.role === 'admin') {
      avatar.textContent = "AD";
      role.textContent = "Controle Total";
      avatar.style.backgroundColor = "var(--primary)";
    } else if (state.currentUser.role === 'enfermeiro') {
      avatar.textContent = "MS";
      role.textContent = "Coord. de Escalas";
      avatar.style.backgroundColor = "var(--secondary)";
    } else if (state.currentUser.role === 'tecnico') {
      avatar.textContent = "RS";
      role.textContent = "Minha Escala";
      avatar.style.backgroundColor = "var(--warning)";
    }
  }

  function applyAccessControlPolicies() {
    if (!state.currentUser) return;
    
    const role = state.currentUser.role;
    
    // Habilitar/Desabilitar botões estruturais
    const btnOpenCustomScale = document.getElementById('btn-open-custom-scale');
    const btnAddQuick = document.getElementById('btn-add-colaborador-quick');
    const btnAddFull = document.getElementById('btn-add-colaborador-full');
    const autoGenDrawer = document.querySelector('.generator-drawer');
    const staffHeader = document.querySelector('.staff-header-actions');

    if (role === 'admin') {
      // ADMIN: Total
      if (btnOpenCustomScale) btnOpenCustomScale.style.display = 'inline-flex';
      if (btnAddQuick) btnAddQuick.style.display = 'inline-flex';
      if (btnAddFull) btnAddFull.style.display = 'inline-flex';
      if (autoGenDrawer) autoGenDrawer.style.display = 'flex';
      if (staffHeader) staffHeader.style.display = 'flex';

      // Habilitar abas de WFM
      document.querySelectorAll('.nav-item').forEach(item => item.style.opacity = '1');

    } else if (role === 'enfermeiro') {
      // ENFERMEIRO: Controla técnicas de enfermagem
      // Não pode adicionar/remover profissionais ou criar novas escalas customizadas
      if (btnOpenCustomScale) btnOpenCustomScale.style.display = 'none';
      if (btnAddQuick) btnAddQuick.style.display = 'none';
      if (btnAddFull) btnAddFull.style.display = 'none';
      
      // Pode gerar escalas automáticas apenas para Técnicos
      if (autoGenDrawer) autoGenDrawer.style.display = 'flex';
      if (staffHeader) staffHeader.style.display = 'none';

      document.querySelectorAll('.nav-item').forEach(item => item.style.opacity = '1');

    } else if (role === 'tecnico') {
      // TÉCNICO: Apenas visualiza e gerencia folgas próprias
      if (btnOpenCustomScale) btnOpenCustomScale.style.display = 'none';
      if (btnAddQuick) btnAddQuick.style.display = 'none';
      if (btnAddFull) btnAddFull.style.display = 'none';
      if (autoGenDrawer) autoGenDrawer.style.display = 'none';
      if (staffHeader) staffHeader.style.display = 'none';

      // Bloquear abas Dimensionamento e Central de Trocas
      document.querySelectorAll('.nav-item').forEach(item => {
        const tab = item.dataset.tab;
        if (tab === 'dimensionamento' || tab === 'trocas') {
          item.style.opacity = '0.4';
        } else {
          item.style.opacity = '1';
        }
      });
    }
  }

  // --- GESTÃO DE PERSISTÊNCIA (LOCALSTORAGE) ---
  function loadData() {
    const storedEmployees = localStorage.getItem('ej_employees');
    const storedShifts = localStorage.getItem('ej_shifts');

    if (storedEmployees) {
      try {
        const parsed = JSON.parse(storedEmployees);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.employees = parsed;
        } else {
          state.employees = [...DEFAULT_EMPLOYEES];
          localStorage.setItem('ej_employees', JSON.stringify(state.employees));
        }
      } catch (e) {
        state.employees = [...DEFAULT_EMPLOYEES];
        localStorage.setItem('ej_employees', JSON.stringify(state.employees));
      }
    } else {
      state.employees = [...DEFAULT_EMPLOYEES];
      localStorage.setItem('ej_employees', JSON.stringify(state.employees));
    }

    if (storedShifts) {
      try {
        state.shifts = JSON.parse(storedShifts);
      } catch (e) {
        state.shifts = {};
        state.employees.forEach(emp => {
          state.shifts[emp.id] = seedShiftsForEmployee(emp);
        });
        localStorage.setItem('ej_shifts', JSON.stringify(state.shifts));
      }
    } else {
      state.shifts = {};
      state.employees.forEach(emp => {
        state.shifts[emp.id] = seedShiftsForEmployee(emp);
      });
      localStorage.setItem('ej_shifts', JSON.stringify(state.shifts));
    }
  }

  function saveData() {
    localStorage.setItem('ej_employees', JSON.stringify(state.employees));
    localStorage.setItem('ej_shifts', JSON.stringify(state.shifts));
  }

  // Semeador de turnos padrão inteligente cobrindo os meses de Abril, Maio e Junho de 2026
  function seedShiftsForEmployee(emp) {
    const employeeShifts = {};
    
    const datesToSeed = [];
    for (let d = 1; d <= 30; d++) datesToSeed.push({ y: 2026, m: 3, d }); // Abril
    for (let d = 1; d <= 31; d++) datesToSeed.push({ y: 2026, m: 4, d }); // Maio
    for (let d = 1; d <= 30; d++) datesToSeed.push({ y: 2026, m: 5, d }); // Junho
    
    if (emp.scale === '12x36') {
      let works = (parseInt(emp.id.replace('emp-', '')) % 2 === 0);
      const defaultShift = emp.role.includes('Médico') || emp.role.includes('Supervisor') ? 'N' : 'M';
      
      datesToSeed.forEach(dt => {
        const dateStr = `${dt.y}-${String(dt.m + 1).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;
        employeeShifts[dateStr] = works ? defaultShift : 'F';
        works = !works;
      });
    } else if (emp.scale === '5x2') {
      datesToSeed.forEach(dt => {
        const date = new Date(dt.y, dt.m, dt.d);
        const dayOfWeek = date.getDay(); // 0 = Dom, 6 = Sáb
        const dateStr = `${dt.y}-${String(dt.m + 1).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          employeeShifts[dateStr] = 'F';
        } else {
          employeeShifts[dateStr] = 'M';
        }
      });
    } else if (emp.scale === '6x1') {
      let consecWork = parseInt(emp.id.replace('emp-', '')) % 6;
      datesToSeed.forEach(dt => {
        const dateStr = `${dt.y}-${String(dt.m + 1).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;
        if (consecWork === 5) {
          employeeShifts[dateStr] = 'F';
          consecWork = 0;
        } else {
          employeeShifts[dateStr] = 'T';
          consecWork++;
        }
      });
    }
    
    return employeeShifts;
  }

  // --- POPULAR DINAMICAMENTE FILTROS E DROPDOWNS DE SETORES ---
  function populateSectorFilters() {
    const filterSectorSelect = document.getElementById('filter-sector');
    const dimSectorSelect = document.getElementById('dim-sector-select');
    if (!filterSectorSelect || !dimSectorSelect) return;

    const currentFilterVal = filterSectorSelect.value;
    const currentDimVal = dimSectorSelect.value;

    const sectors = [...new Set(state.employees.map(emp => emp.sector))];

    // Recriar opções no filtro da matriz de escalas
    filterSectorSelect.innerHTML = '<option value="all">Setor: Todos</option>';
    sectors.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.textContent = sec;
      filterSectorSelect.appendChild(opt);
    });

    // Recriar opções no simulador de dimensionamento
    dimSectorSelect.innerHTML = '';
    sectors.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.textContent = sec;
      dimSectorSelect.appendChild(opt);
    });

    // Restaurar seleções anteriores
    if (sectors.includes(currentFilterVal)) {
      filterSectorSelect.value = currentFilterVal;
    } else {
      filterSectorSelect.value = 'all';
    }

    if (sectors.includes(currentDimVal)) {
      dimSectorSelect.value = currentDimVal;
    } else if (sectors.length > 0) {
      dimSectorSelect.value = sectors[0];
    }
  }

  // Popular dropdown de setores do formulário de lançamento de colaborador
  function populateSectorOptionsInForm() {
    const sectorFormSelect = document.getElementById('emp-sector');
    if (!sectorFormSelect) return;

    const sectors = [...new Set(state.employees.map(emp => emp.sector))];
    
    sectorFormSelect.innerHTML = '';
    sectors.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec;
      opt.textContent = sec;
      sectorFormSelect.appendChild(opt);
    });
  }

  // --- OBTENÇÃO DOS DIAS DO CICLO (DO DIA 16 DO MÊS ANTERIOR AO DIA 15 DO MÊS ATUAL) ---
  function getCycleDays(year, month) {
    const cycleDays = [];
    
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }
    
    const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    // Dias 16 ao fim do mês anterior
    for (let day = 16; day <= prevMonthDays; day++) {
      const date = new Date(prevYear, prevMonth, day);
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cycleDays.push({
        day: day,
        month: prevMonth,
        year: prevYear,
        dateStr: dateStr,
        weekday: date.getDay(),
        label: `${day}/${MONTHS_NAMES[prevMonth].slice(0, 3)}`
      });
    }
    
    // Dias 1 ao 15 do mês corrente
    for (let day = 1; day <= 15; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cycleDays.push({
        day: day,
        month: month,
        year: year,
        dateStr: dateStr,
        weekday: date.getDay(),
        label: `${day}/${MONTHS_NAMES[month].slice(0, 3)}`
      });
    }
    
    return cycleDays;
  }

  // --- MOTOR DE VALIDAÇÃO DE REGRAS CLT ---
  function validateCLTRules(shifts, employees, year, month) {
    const violations = [];
    const cycleDays = getCycleDays(year, month);
    
    employees.forEach(emp => {
      const empShifts = shifts[emp.id] || {};
      
      let consecutiveWorkDays = 0;
      let sundaysWorked = [];
      let sundaysOff = 0;

      for (let i = 0; i < cycleDays.length; i++) {
        const dayInfo = cycleDays[i];
        const dateStr = dayInfo.dateStr;
        const currentShift = empShifts[dateStr] || 'empty';
        const isWorking = currentShift !== 'F' && currentShift !== 'LM' && currentShift !== 'empty';
        const isSunday = dayInfo.weekday === 0;

        // Controle do 6x1 e trabalho ininterrupto
        if (isWorking) {
          consecutiveWorkDays++;
          if (consecutiveWorkDays >= 7) {
            violations.push({
              employeeId: emp.id,
              employeeName: emp.name,
              date: dateStr,
              rule: "Trabalho Consecutivo Excessivo",
              type: "danger",
              description: `${emp.name} trabalhou ${consecutiveWorkDays} dias consecutivos sem folga, violando o limite semanal da CLT (Máx 6 dias).`
            });
          }
        } else {
          consecutiveWorkDays = 0;
        }

        // DSR aos Domingos
        if (isSunday) {
          if (isWorking) {
            sundaysWorked.push(dateStr);
          } else if (currentShift === 'F') {
            sundaysOff++;
          }
        }

        // Descanso Interjornada de 11 Horas
        if (i < cycleDays.length - 1) {
          const nextDayInfo = cycleDays[i + 1];
          const nextDayStr = nextDayInfo.dateStr;
          const nextShift = empShifts[nextDayStr] || 'empty';
          
          if (currentShift === 'N') {
            if (nextShift === 'M') {
              violations.push({
                employeeId: emp.id,
                employeeName: emp.name,
                date: nextDayStr,
                rule: "Descanso Interjornada Violado",
                type: "danger",
                description: `Intervalo interjornada de apenas 0h para ${emp.name}. Saiu do plantão Noturno às 07:00 e iniciou o Manhã às 07:00.`
              });
            } else if (nextShift === 'T') {
              violations.push({
                employeeId: emp.id,
                employeeName: emp.name,
                date: nextDayStr,
                rule: "Descanso Interjornada Insuficiente",
                type: "warning",
                description: `Intervalo interjornada de apenas 6h para ${emp.name}. Saiu do plantão Noturno às 07:00 e iniciou o Tarde às 13:00 (Mínimo CLT é 11h).`
              });
            }
          }
        }

        // Escala 12x36
        if (emp.scale === '12x36' && i < cycleDays.length - 1) {
          const nextDayInfo = cycleDays[i + 1];
          const nextDayStr = nextDayInfo.dateStr;
          const nextShift = empShifts[nextDayStr] || 'empty';
          const isNextWorking = nextShift !== 'F' && nextShift !== 'LM' && nextShift !== 'empty';
          
          if (isWorking && isNextWorking) {
            violations.push({
              employeeId: emp.id,
              employeeName: emp.name,
              date: nextDayStr,
              rule: "Violação de Escala 12x36",
              type: "danger",
              description: `Escala 12x36 exige descanso imediato de 36h. ${emp.name} está escalado para trabalhar consecutivamente nos dias ${dayInfo.label} e ${nextDayInfo.label}.`
            });
          }
        }
      }

      // Validação comercial de DSR aos Domingos
      if (emp.scale === '5x2' && sundaysWorked.length > 2) {
        violations.push({
          employeeId: emp.id,
          employeeName: emp.name,
          date: sundaysWorked[sundaysWorked.length - 1],
          rule: "DSR aos Domingos Ausente",
          type: "warning",
          description: `${emp.name} (escala 5x2) trabalhou em ${sundaysWorked.length} domingos neste ciclo, excedendo o limite de DSR preferencial.`
        });
      }
    });

    return violations;
  }

  // --- RENDERIZAÇÕES PRINCIPAIS ---
  function renderAll() {
    if (!state.currentUser) return;

    const currentMonthViolations = validateCLTRules(state.shifts, state.employees, state.currentYear, state.currentMonth);
    
    renderDashboard(currentMonthViolations);
    renderScaleMatrix(currentMonthViolations);
    renderStaffTab(currentMonthViolations);
    renderTradeSelectors();
    renderDimensioning();
    
    // Atualizar badge de notificações
    document.getElementById('alerts-count-badge').textContent = currentMonthViolations.length;
  }

  // 1. Dashboard
  function renderDashboard(violations) {
    const totalStaff = state.employees.length;
    let activeToday = 0;
    let offToday = 0;
    
    state.employees.forEach(emp => {
      const dayShift = (state.shifts[emp.id] || {})[state.todayStr] || 'empty';
      if (dayShift === 'F' || dayShift === 'LM') {
        offToday++;
      } else if (dayShift !== 'empty') {
        activeToday++;
      }
    });

    document.getElementById('stat-total-staff').textContent = totalStaff;
    document.getElementById('stat-active-today').textContent = activeToday;
    document.getElementById('stat-off-today').textContent = offToday;
    document.getElementById('stat-clt-warnings').textContent = violations.length;

    const alertsFeed = document.getElementById('dashboard-alerts-list');
    alertsFeed.innerHTML = '';

    if (violations.length === 0) {
      alertsFeed.innerHTML = `
        <div class="empty-alerts">
          <span class="material-symbols-outlined">check_circle</span>
          <p>Tudo sob conformidade! Nenhuma infração trabalhista identificada neste ciclo.</p>
        </div>
      `;
    } else {
      violations.forEach(v => {
        const item = document.createElement('div');
        item.className = `alert-item ${v.type}`;
        
        const dateParts = v.date.split('-');
        const formattedDate = `${dateParts[2]}/${dateParts[1]}`;
        
        item.innerHTML = `
          <div class="alert-item-icon">
            <span class="material-symbols-outlined">${v.type === 'danger' ? 'report' : 'warning'}</span>
          </div>
          <div class="alert-details">
            <h5>${v.rule} - ${v.employeeName}</h5>
            <p>${v.description}</p>
            <span>Referência: Dia ${formattedDate}</span>
          </div>
        `;
        
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          document.getElementById('search-scale-employee').value = v.employeeName;
          switchTab('escala');
          renderAll();
        });

        alertsFeed.appendChild(item);
      });
    }

    calculateDimensioningPreview();
  }

  // Prévia do dimensionamento
  function calculateDimensioningPreview() {
    const activePatients = Math.ceil(40 * 0.75);
    const ratio = 3;
    const reqNurses = Math.ceil(activePatients / ratio);
    const reqTechs = Math.ceil(reqNurses * 1.5);
    const reqTotal = reqNurses + reqTechs;

    const firstSector = document.getElementById('dim-sector-select').value || 'UTI Adulto';
    let actTotal = 0;
    
    state.employees.forEach(emp => {
      if (emp.sector === firstSector) {
        const currentShift = (state.shifts[emp.id] || {})[state.todayStr] || 'empty';
        if (currentShift !== 'F' && currentShift !== 'LM' && currentShift !== 'empty') {
          actTotal++;
        }
      }
    });

    document.getElementById('dash-leitos-val').textContent = `${activePatients}/40`;
    document.getElementById('dash-enf-req').textContent = reqTotal;
    document.getElementById('dash-enf-act').textContent = actTotal;

    const percentage = reqTotal > 0 ? Math.round((actTotal / reqTotal) * 100) : 100;
    const progressFill = document.getElementById('dash-dim-progress');
    const statusTxt = document.getElementById('dash-dim-status-txt');

    if (progressFill) progressFill.style.width = `${Math.min(percentage, 100)}%`;

    if (statusTxt) {
      if (percentage < 85) {
        statusTxt.textContent = `Déficit (${percentage}%)`;
        statusTxt.style.color = 'var(--danger)';
        if (progressFill) progressFill.style.background = 'var(--danger)';
      } else if (percentage > 115) {
        statusTxt.textContent = `Superávit (${percentage}%)`;
        statusTxt.style.color = 'var(--warning)';
        if (progressFill) progressFill.style.background = 'var(--warning)';
      } else {
        statusTxt.textContent = `Adequado (${percentage}%)`;
        statusTxt.style.color = 'var(--secondary)';
        if (progressFill) progressFill.style.background = 'var(--secondary)';
      }
    }
  }

  // 2. Escala Mensal (Matriz Grid com ciclo 16 a 15)
  function renderScaleMatrix(violations) {
    const year = state.currentYear;
    const month = state.currentMonth;
    
    const cycleDays = getCycleDays(year, month);
    document.getElementById('label-current-month').textContent = `Ciclo: 16/${MONTHS_NAMES[month-1 < 0 ? 11 : month-1].slice(0,3)} a 15/${MONTHS_NAMES[month].slice(0,3)} de ${year}`;
    
    const headerRow = document.getElementById('matrix-header-row');
    const bodyRows = document.getElementById('matrix-body-rows');
    
    while (headerRow.children.length > 1) {
      headerRow.removeChild(headerRow.lastChild);
    }
    bodyRows.innerHTML = '';
    
    cycleDays.forEach(dayInfo => {
      const th = document.createElement('th');
      th.className = 'day-header';
      if (dayInfo.weekday === 0 || dayInfo.weekday === 6) {
        th.classList.add('weekend');
      }
      
      th.innerHTML = `
        ${dayInfo.day}
        <span>${WEEKDAYS_SHORT[dayInfo.weekday]}</span>
      `;
      headerRow.appendChild(th);
    });
    
    // Filtros ativos
    const sectorFilter = document.getElementById('filter-sector').value;
    const scaleFilter = document.getElementById('filter-scale').value;
    const searchFilter = document.getElementById('search-scale-employee').value.toLowerCase();
    
    const filteredEmployees = state.employees.filter(emp => {
      const matchesSector = (sectorFilter === 'all' || emp.sector === sectorFilter);
      const matchesScale = (scaleFilter === 'all' || emp.scale === scaleFilter);
      const matchesSearch = emp.name.toLowerCase().includes(searchFilter) || emp.role.toLowerCase().includes(searchFilter);
      return matchesSector && matchesScale && matchesSearch;
    });

    // Popular dropdown do Gerador Automático de Escalas
    const genEmpSelect = document.getElementById('gen-employee');
    if (genEmpSelect) {
      genEmpSelect.innerHTML = '';
      
      // Se for enfermeiro, só pode gerar escalas para técnicos!
      const employeesForDropdown = (state.currentUser && state.currentUser.role === 'enfermeiro') ?
        state.employees.filter(emp => emp.role.toLowerCase().includes('técnico') || emp.role.toLowerCase().includes('técnica')) :
        state.employees;

      employeesForDropdown.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.name} [${emp.sector}]`;
        genEmpSelect.appendChild(opt);
      });
    }
    
    if (filteredEmployees.length === 0) {
      const emptyTr = document.createElement('tr');
      emptyTr.innerHTML = `
        <td colspan="${cycleDays.length + 1}" style="text-align: center; padding: 32px; color: var(--text-muted);">
          Nenhum profissional encontrado com os filtros selecionados.
        </td>
      `;
      bodyRows.appendChild(emptyTr);
      return;
    }

    // Renderizar Linhas
    filteredEmployees.forEach(emp => {
      const tr = document.createElement('tr');
      
      const tdEmp = document.createElement('td');
      tdEmp.className = 'col-employee';
      tdEmp.innerHTML = `
        <div class="employee-meta">
          <span class="employee-name">${emp.name}</span>
          <span class="employee-role">${emp.role}</span>
          <span class="employee-scale-tag">${emp.scale} | ${emp.sector}</span>
        </div>
      `;
      tr.appendChild(tdEmp);
      
      const empShifts = state.shifts[emp.id] || {};
      
      cycleDays.forEach(dayInfo => {
        const dateStr = dayInfo.dateStr;
        const shift = empShifts[dateStr] || 'empty';
        
        const tdDay = document.createElement('td');
        tdDay.className = 'cell-day';
        
        const hasViolation = violations.find(v => v.employeeId === emp.id && v.date === dateStr);
        if (hasViolation) {
          tdDay.classList.add('violation');
          tdDay.title = hasViolation.description;
          
          const dot = document.createElement('span');
          dot.className = 'violation-indicator';
          tdDay.appendChild(dot);
        }
        
        const badge = document.createElement('div');
        badge.className = `shift-badge ${shift}`;
        badge.textContent = shift === 'empty' ? '-' : shift;
        
        tdDay.appendChild(badge);
        
        tdDay.addEventListener('click', () => {
          handleCellClick(emp.id, dateStr, shift, hasViolation, emp.role);
        });
        
        tr.appendChild(tdDay);
      });
      
      bodyRows.appendChild(tr);
    });
  }

  // Interceptar cliques nas células aplicando controle hierárquico
  function handleCellClick(employeeId, dateStr, currentShift, violation, roleName) {
    if (!state.currentUser) return;

    const userRole = state.currentUser.role;
    const userId = state.currentUser.id;

    if (userRole === 'admin') {
      // ADMIN: Edita qualquer um
      openEditShiftModal(employeeId, dateStr, currentShift, violation);
    } else if (userRole === 'enfermeiro') {
      // ENFERMEIRO: Só edita técnicos de enfermagem
      const isTechnician = roleName.toLowerCase().includes('técnico') || roleName.toLowerCase().includes('técnica');
      if (isTechnician) {
        openEditShiftModal(employeeId, dateStr, currentShift, violation);
      } else {
        showToast("Acesso Negado. Enfermeiros só podem editar escalas de Técnicos de Enfermagem.", "warning");
      }
    } else if (userRole === 'tecnico') {
      // TÉCNICO: Só edita ele mesmo (emp-3 - Roberto Silva neste caso)
      if (employeeId === userId) {
        openEditShiftModal(employeeId, dateStr, currentShift, violation);
      } else {
        showToast("Acesso Negado. Técnicos só podem lançar folgas na sua própria escala.", "warning");
      }
    }
  }

  // 3. Aba Colaboradores
  function renderStaffTab(violations) {
    const grid = document.getElementById('staff-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchVal = document.getElementById('search-staff-input').value.toLowerCase();
    
    const filtered = state.employees.filter(emp => {
      return emp.name.toLowerCase().includes(searchVal) || 
             emp.role.toLowerCase().includes(searchVal) || 
             emp.sector.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-muted);">
          Nenhum colaborador encontrado com esta busca.
        </div>
      `;
      return;
    }

    filtered.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'card staff-card';

      const empWarnings = violations.filter(v => v.employeeId === emp.id).length;
      const shiftToday = (state.shifts[emp.id] || {})[state.todayStr] || 'empty';
      let shiftText = "- Sem Escala -";
      if (shiftToday === 'M') shiftText = "Manhã (Ativo)";
      else if (shiftToday === 'T') shiftText = "Tarde (Ativo)";
      else if (shiftToday === 'N') shiftText = "Noite (Ativo)";
      else if (shiftToday === 'F') shiftText = "Folga";
      else if (shiftToday === 'LM') shiftText = "Licença Médica";

      const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

      card.innerHTML = `
        <div class="staff-card-header">
          <div class="staff-card-avatar">${initials}</div>
          <div class="staff-card-title">
            <h4>${emp.name}</h4>
            <p>${emp.role}</p>
          </div>
        </div>
        
        <div class="staff-card-body">
          <div class="staff-info-row">
            <span class="staff-info-label">Setor</span>
            <span class="staff-info-val">${emp.sector}</span>
          </div>
          <div class="staff-info-row">
            <span class="staff-info-label">Escala CLT</span>
            <span class="staff-info-val">${emp.scale}</span>
          </div>
          <div class="staff-info-row">
            <span class="staff-info-label">Status Hoje</span>
            <span class="staff-info-val" style="color: ${shiftToday === 'F' ? 'var(--text-muted)' : 'var(--primary)'}">${shiftText}</span>
          </div>
          <div class="staff-info-row">
            <span class="staff-info-label">Alertas CLT (Ciclo)</span>
            <span class="staff-info-val" style="color: ${empWarnings > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 700;">
              ${empWarnings} ${empWarnings === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>
        </div>
        
        <div class="staff-card-footer">
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.filterByEmployeeName('${emp.name}')">
            <span class="material-symbols-outlined" style="font-size: 16px;">calendar_month</span>
            Escala
          </button>
          <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px; background-color: var(--danger-glow); color: var(--danger);" onclick="window.deleteEmployee('${emp.id}')">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
            Remover
          </button>
        </div>
      `;

      // Se for Enfermeiro ou Técnico, esconder botões de remoção no cartão
      if (state.currentUser && state.currentUser.role !== 'admin') {
        const removeBtn = card.querySelector('.btn-danger');
        if (removeBtn) removeBtn.style.display = 'none';
      }

      grid.appendChild(card);
    });
  }

  // 4. Central de Trocas
  function renderTradeSelectors() {
    const empSelectA = document.getElementById('trade-emp-a');
    const empSelectB = document.getElementById('trade-emp-b');
    if (!empSelectA || !empSelectB) return;
    
    const valA = empSelectA.value;
    const valB = empSelectB.value;

    empSelectA.innerHTML = '<option value="">Selecione...</option>';
    empSelectB.innerHTML = '<option value="">Selecione...</option>';

    // Se for Enfermeiro, só pode selecionar Técnicos para trocas
    const listEmployees = (state.currentUser && state.currentUser.role === 'enfermeiro') ?
      state.employees.filter(emp => emp.role.toLowerCase().includes('técnico') || emp.role.toLowerCase().includes('técnica')) :
      state.employees;

    listEmployees.forEach(emp => {
      const optA = document.createElement('option');
      optA.value = emp.id;
      optA.textContent = `${emp.name} [${emp.sector}]`;
      empSelectA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = emp.id;
      optB.textContent = `${emp.name} [${emp.sector}]`;
      empSelectB.appendChild(optB);
    });

    if (valA) empSelectA.value = valA;
    if (valB) empSelectB.value = valB;
  }

  // 5. Dimensionamento
  function renderDimensioning() {
    const bedsInput = document.getElementById('dim-beds-range');
    const occupancyInput = document.getElementById('dim-occupancy-range');
    if (!bedsInput || !occupancyInput) return;
    
    const beds = parseInt(bedsInput.value);
    const occupancy = parseInt(occupancyInput.value);
    
    const activeBtn = document.querySelector('#dim-complexity-buttons .select-btn.active');
    const ratio = activeBtn ? parseInt(activeBtn.dataset.ratio) : 3;
    const complexityName = activeBtn ? activeBtn.dataset.level : 'semi-intensivo';
    
    const activePatients = Math.ceil(beds * (occupancy / 100));
    
    const reqNurses = Math.ceil(activePatients / ratio);
    const reqTechs = Math.ceil(reqNurses * 1.5);
    const reqTotal = reqNurses + reqTechs;

    const selectedSector = document.getElementById('dim-sector-select').value;
    let actTotal = 0;

    state.employees.forEach(emp => {
      if (emp.sector === selectedSector) {
        const currentShift = (state.shifts[emp.id] || {})[state.todayStr] || 'empty';
        if (currentShift !== 'F' && currentShift !== 'LM' && currentShift !== 'empty') {
          actTotal++;
        }
      }
    });

    document.getElementById('dim-staff-required').textContent = reqTotal;
    document.getElementById('dim-staff-actual').textContent = actTotal;

    const percentage = reqTotal > 0 ? Math.round((actTotal / reqTotal) * 100) : 100;
    const progressFill = document.getElementById('dim-progress-bar-fill');
    const percentageLabel = document.getElementById('dim-status-percentage');

    if (progressFill) progressFill.style.width = `${Math.min(percentage, 100)}%`;
    if (percentageLabel) percentageLabel.textContent = `${percentage}% da Capacidade Requerida`;

    const alertBanner = document.getElementById('dim-alert-banner');
    const alertIcon = document.getElementById('dim-alert-icon');
    const alertText = document.getElementById('dim-alert-text');

    if (alertBanner) {
      alertBanner.className = 'dim-status-alert';

      if (percentage < 85) {
        alertBanner.classList.add('deficit');
        if (alertIcon) alertIcon.textContent = 'warning';
        if (alertText) alertText.innerHTML = `<strong>Déficit de Staff!</strong> Faltam profissionais para cobrir com segurança a UTI no nível de complexidade <em>${complexityName}</em>. Recomenda-se remanejar técnicos de outros setores.`;
        if (progressFill) progressFill.style.background = 'var(--danger)';
      } else if (percentage > 115) {
        alertBanner.classList.add('surplus');
        if (alertIcon) alertIcon.textContent = 'info';
        if (alertText) alertText.innerHTML = `<strong>Superávit de Profissionais!</strong> O setor está com excesso de equipe para a demanda atual. Considere conceder folgas acumuladas ou banco de horas.`;
        if (progressFill) progressFill.style.background = 'var(--warning)';
      } else {
        alertBanner.classList.add('optimal');
        if (alertIcon) alertIcon.textContent = 'check_circle';
        if (alertText) alertText.innerHTML = `<strong>Dimensionamento Ótimo!</strong> Equipe programada atende perfeitamente à ocupação de ${activePatients} pacientes graves com segurança absoluta.`;
        if (progressFill) progressFill.style.background = 'var(--secondary)';
      }
    }
  }

  // --- NAVEGAÇÃO ---
  function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        // Bloquear abas se for Técnico
        const tab = item.dataset.tab;
        if (state.currentUser && state.currentUser.role === 'tecnico') {
          if (tab === 'dimensionamento' || tab === 'trocas') {
            showToast("Acesso Negado. Esta tela é restrita a Administradores e Enfermeiros.", "warning");
            return;
          }
        }
        switchTab(tab);
      });
    });

    window.switchTab = switchTab;
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    const hTitle = document.getElementById('header-view-title');
    const hSub = document.getElementById('header-view-subtitle');

    switch (tabId) {
      case 'dashboard':
        hTitle.textContent = "Painel Geral";
        hSub.textContent = "Resumo operacional e monitoramento de conformidade CLT";
        break;
      case 'escala':
        hTitle.textContent = "Escala de Plantões";
        hSub.textContent = "Organize, valide legislações e exporte a grade do ciclo ativo";
        break;
      case 'colaboradores':
        hTitle.textContent = "Equipe do Hospital";
        hSub.textContent = "Gerencie cadastros, setores e configurações de escalas individuais";
        break;
      case 'trocas':
        hTitle.textContent = "Central de Troca de Plantão";
        hSub.textContent = "Realize simulações e troque turnos com validação jurídica em tempo real";
        break;
      case 'dimensionamento':
        hTitle.textContent = "Dimensionamento Inteligente";
        hSub.textContent = "Einstein WFM - Calcule o contingente necessário com base na ocupação real";
        break;
    }

    renderAll();
  }

  // --- CONFIGURAÇÃO DE EVENTOS ---
  function setupEventListeners() {
    // 1. Login e Acesso
    document.getElementById('btn-login-submit').addEventListener('click', handleLoginSubmit);
    document.getElementById('sidebar-user-card').addEventListener('click', handleLogout);
    
    const loginProfileSelect = document.getElementById('login-profile');
    if (loginProfileSelect) {
      loginProfileSelect.addEventListener('change', (e) => {
        const passGroup = document.getElementById('login-password-group');
        // Senha é requerida para todos, mas podemos limpar o campo para eles digitarem
        document.getElementById('login-password').value = '';
      });
    }

    // 2. Filtros
    document.getElementById('filter-sector').addEventListener('change', () => renderAll());
    document.getElementById('filter-scale').addEventListener('change', () => renderAll());
    document.getElementById('search-scale-employee').addEventListener('input', () => renderAll());

    // 3. Navegador de Ciclos
    document.getElementById('btn-prev-month').addEventListener('click', () => {
      if (state.currentMonth === 0) {
        state.currentMonth = 11;
        state.currentYear--;
      } else {
        state.currentMonth--;
      }
      renderAll();
    });

    document.getElementById('btn-next-month').addEventListener('click', () => {
      if (state.currentMonth === 11) {
        state.currentMonth = 0;
        state.currentYear++;
      } else {
        state.currentMonth++;
      }
      renderAll();
    });

    // 4. Imprimir
    document.getElementById('btn-print-scale').addEventListener('click', () => {
      window.print();
    });

    // 5. Gerador Automático
    document.getElementById('btn-trigger-generator').addEventListener('click', handleAutoGenerateScale);

    // 6. Gestão de Colaboradores
    document.getElementById('search-staff-input').addEventListener('input', () => renderAll());
    document.getElementById('btn-add-colaborador-quick').addEventListener('click', () => openModal('modal-add-employee'));
    document.getElementById('btn-add-colaborador-full').addEventListener('click', () => openModal('modal-add-employee'));
    document.getElementById('btn-submit-employee').addEventListener('click', handleAddEmployee);

    // Toggle Novo Setor no Formulário
    const btnToggleSector = document.getElementById('btn-toggle-new-sector');
    if (btnToggleSector) {
      btnToggleSector.addEventListener('click', () => {
        const select = document.getElementById('emp-sector');
        const input = document.getElementById('emp-sector-new');
        const icon = document.getElementById('toggle-sector-icon');
        
        if (select.style.display === 'none') {
          select.style.display = 'block';
          input.style.display = 'none';
          icon.textContent = 'add';
          input.value = '';
        } else {
          select.style.display = 'none';
          input.style.display = 'block';
          icon.textContent = 'list';
        }
      });
    }

    // 7. Nova Escala Customizada
    const btnOpenCustomScale = document.getElementById('btn-open-custom-scale');
    if (btnOpenCustomScale) {
      btnOpenCustomScale.addEventListener('click', openCustomScaleModal);
    }
    const btnSubmitCustomScale = document.getElementById('btn-submit-custom-scale');
    if (btnSubmitCustomScale) {
      btnSubmitCustomScale.addEventListener('click', handleSubmitCustomScale);
    }

    // 8. Troca de Plantão
    const empSelectA = document.getElementById('trade-emp-a');
    const empSelectB = document.getElementById('trade-emp-b');
    
    if (empSelectA && empSelectB) {
      empSelectA.addEventListener('change', () => handleTradeEmployeeSelect('A'));
      empSelectB.addEventListener('change', () => handleTradeEmployeeSelect('B'));
    }
    
    const btnValTrade = document.getElementById('btn-validate-trade');
    const btnExecTrade = document.getElementById('btn-execute-trade');
    if (btnValTrade) btnValTrade.addEventListener('click', handleValidateTrade);
    if (btnExecTrade) btnExecTrade.addEventListener('click', handleExecuteTrade);

    // 9. Dimensionamento Sliders
    const bedsSlider = document.getElementById('dim-beds-range');
    const occupancySlider = document.getElementById('dim-occupancy-range');
    
    if (bedsSlider) {
      bedsSlider.addEventListener('input', (e) => {
        document.getElementById('val-dim-beds').textContent = `${e.target.value} leitos`;
        renderDimensioning();
      });
    }
    
    if (occupancySlider) {
      occupancySlider.addEventListener('input', (e) => {
        document.getElementById('val-dim-occupancy').textContent = `${e.target.value}%`;
        renderDimensioning();
      });
    }

    const dimSector = document.getElementById('dim-sector-select');
    if (dimSector) dimSector.addEventListener('change', () => renderDimensioning());

    const compButtons = document.querySelectorAll('#dim-complexity-buttons .select-btn');
    compButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        compButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDimensioning();
      });
    });

    // 10. Salvar Escala Manual
    document.getElementById('btn-save-shift').addEventListener('click', handleSaveShiftEdit);
    
    // 11. Central de Alertas
    document.getElementById('btn-notifications-feed').addEventListener('click', () => {
      switchTab('dashboard');
      showToast("Visualizando todos os alertas CLT ativos no ciclo.", "info");
    });
  }

  // --- FUNÇÕES DE TRATAMENTO ---

  // Gerador automático de escalas
  function handleAutoGenerateScale() {
    if (state.currentUser && state.currentUser.role === 'tecnico') {
      showToast("Acesso Negado. Técnicos não podem utilizar o gerador automático.", "warning");
      return;
    }

    const employeeId = document.getElementById('gen-employee').value;
    const scaleType = document.getElementById('gen-scale-type').value;
    const startDateVal = document.getElementById('gen-start-date').value;
    const baseShift = document.getElementById('gen-shift').value;

    if (!employeeId || !startDateVal) {
      showToast("Preencha todos os campos do gerador!", "danger");
      return;
    }

    const employee = state.employees.find(e => e.id === employeeId);
    if (!employee) return;

    // Se for Enfermeiro, validar se o funcionário é Técnico
    if (state.currentUser && state.currentUser.role === 'enfermeiro') {
      const isTechnician = employee.role.toLowerCase().includes('técnico') || employee.role.toLowerCase().includes('técnica');
      if (!isTechnician) {
        showToast("Acesso Negado. Enfermeiros só podem gerar escalas de Técnicos.", "warning");
        return;
      }
    }

    employee.scale = scaleType;

    const cycleDays = getCycleDays(state.currentYear, state.currentMonth);
    const startDate = new Date(startDateVal + 'T00:00:00');
    
    if (!state.shifts[employeeId]) {
      state.shifts[employeeId] = {};
    }

    cycleDays.forEach(dayInfo => {
      state.shifts[employeeId][dayInfo.dateStr] = 'empty';
    });

    let cycleCounter = 0;
    
    cycleDays.forEach(dayInfo => {
      const currentDate = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
      
      if (currentDate < startDate) {
        state.shifts[employeeId][dayInfo.dateStr] = 'F';
        return;
      }

      if (scaleType === '12x36') {
        state.shifts[employeeId][dayInfo.dateStr] = (cycleCounter % 2 === 0) ? baseShift : 'F';
        cycleCounter++;
      } else if (scaleType === '5x2') {
        const dayOfWeek = dayInfo.weekday;
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          state.shifts[employeeId][dayInfo.dateStr] = 'F';
        } else {
          state.shifts[employeeId][dayInfo.dateStr] = baseShift;
        }
      } else if (scaleType === '6x1') {
        if (cycleCounter === 6) {
          state.shifts[employeeId][dayInfo.dateStr] = 'F';
          cycleCounter = 0;
        } else {
          state.shifts[employeeId][dayInfo.dateStr] = baseShift;
          cycleCounter++;
        }
      }
    });

    saveData();
    renderAll();
    showToast(`Escala automatizada gerada para ${employee.name}!`, "success");
  }

  // Cadastro de Colaborador
  function handleAddEmployee(e) {
    e.preventDefault();

    if (state.currentUser && state.currentUser.role !== 'admin') {
      showToast("Acesso Negado. Apenas Administradores podem cadastrar profissionais.", "warning");
      return;
    }

    const name = document.getElementById('emp-name').value.trim();
    const role = document.getElementById('emp-role').value.trim();
    const selectSector = document.getElementById('emp-sector').value;
    const newSector = document.getElementById('emp-sector-new').value.trim();
    const scale = document.getElementById('emp-scale').value;
    const email = document.getElementById('emp-email').value.trim();

    // Setor final com base no toggle
    const sector = newSector !== "" ? newSector : selectSector;

    if (!name || !role || !sector || !email) {
      showToast("Preencha todos os campos de cadastro!", "danger");
      return;
    }

    const newId = `emp-${Date.now()}`;
    const newEmp = { id: newId, name, role, sector, scale, email };

    state.employees.push(newEmp);
    state.shifts[newId] = seedShiftsForEmployee(newEmp);

    saveData();
    closeModal('modal-add-employee');
    
    // Resetar formulário
    document.getElementById('form-add-employee').reset();
    document.getElementById('emp-sector-new').value = '';
    document.getElementById('emp-sector-new').style.display = 'none';
    document.getElementById('emp-sector').style.display = 'block';
    document.getElementById('toggle-sector-icon').textContent = 'add';
    
    // Recarregar os filtros de setor com o novo setor incluído dinamicamente!
    populateSectorOptionsInForm();
    populateSectorFilters();
    
    // Exibir imediatamente o setor que foi cadastrado para o colaborador
    document.getElementById('filter-sector').value = sector;

    renderAll();
    showToast(`Colaborador ${name} adicionado ao setor "${sector}"!`, "success");
  }

  // Nova Escala Customizada
  function openCustomScaleModal() {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      showToast("Acesso Negado. Apenas Administradores podem configurar novas escalas.", "warning");
      return;
    }

    const checklist = document.getElementById('custom-scale-employees-checklist');
    if (!checklist) return;

    checklist.innerHTML = '';

    state.employees.forEach(emp => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '10px';
      label.style.fontSize = '13px';
      label.style.cursor = 'pointer';
      label.style.userSelect = 'none';
      label.style.padding = '6px 8px';
      label.style.borderRadius = '6px';
      label.style.transition = 'background-color 0.2s';

      label.innerHTML = `
        <input type="checkbox" value="${emp.id}" class="custom-scale-emp-checkbox" style="width: 16px; height: 16px; cursor: pointer;">
        <div>
          <strong style="color: var(--text-main); font-weight: 600;">${emp.name}</strong>
          <span style="color: var(--text-muted); font-size: 11px;"> - ${emp.role} [Setor: ${emp.sector}]</span>
        </div>
      `;

      label.addEventListener('mouseenter', () => label.style.backgroundColor = 'rgba(0,0,0,0.04)');
      label.addEventListener('mouseleave', () => label.style.backgroundColor = 'transparent');

      checklist.appendChild(label);
    });

    openModal('modal-custom-scale');
  }

  function handleSubmitCustomScale() {
    const sectorName = document.getElementById('custom-sector-name').value.trim();
    const shiftCode = document.getElementById('custom-shift-code').value;
    const scaleType = document.getElementById('custom-scale-type').value;
    const startDateVal = document.getElementById('custom-start-date').value;

    if (!sectorName) {
      showToast("Por favor, informe o nome do setor/ala da nova escala!", "danger");
      return;
    }

    const checkedBoxes = document.querySelectorAll('.custom-scale-emp-checkbox:checked');
    if (checkedBoxes.length === 0) {
      showToast("Selecione pelo menos um colaborador para alocar na nova escala!", "danger");
      return;
    }

    const selectedEmpIds = Array.from(checkedBoxes).map(cb => cb.value);
    const cycleDays = getCycleDays(state.currentYear, state.currentMonth);
    const startDate = new Date(startDateVal + 'T00:00:00');

    selectedEmpIds.forEach(empId => {
      const employee = state.employees.find(e => e.id === empId);
      if (!employee) return;

      employee.sector = sectorName;
      employee.scale = scaleType;

      if (!state.shifts[empId]) {
        state.shifts[empId] = {};
      }

      cycleDays.forEach(dayInfo => {
        state.shifts[empId][dayInfo.dateStr] = 'empty';
      });

      let cycleCounter = 0;

      cycleDays.forEach(dayInfo => {
        const currentDate = new Date(dayInfo.year, dayInfo.month, dayInfo.day);

        if (currentDate < startDate) {
          state.shifts[empId][dayInfo.dateStr] = 'F';
          return;
        }

        if (scaleType === '12x36') {
          state.shifts[empId][dayInfo.dateStr] = (cycleCounter % 2 === 0) ? shiftCode : 'F';
          cycleCounter++;
        } else if (scaleType === '5x2') {
          const dayOfWeek = dayInfo.weekday;
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            state.shifts[empId][dayInfo.dateStr] = 'F';
          } else {
            state.shifts[empId][dayInfo.dateStr] = shiftCode;
          }
        } else if (scaleType === '6x1') {
          if (cycleCounter === 6) {
            state.shifts[empId][dayInfo.dateStr] = 'F';
            cycleCounter = 0;
          } else {
            state.shifts[empId][dayInfo.dateStr] = shiftCode;
            cycleCounter++;
          }
        }
      });
    });

    saveData();
    populateSectorOptionsInForm(); // Sincronizar formulários
    populateSectorFilters();

    document.getElementById('filter-sector').value = sectorName;
    closeModal('modal-custom-scale');
    document.getElementById('custom-sector-name').value = '';

    renderAll();
    showToast(`Setor "${sectorName}" configurado e escala criada para ${selectedEmpIds.length} colaboradores!`, "success");
  }

  // --- TRATAMENTO TROCA DE PLANTÃO ---
  function handleTradeEmployeeSelect(party) {
    const empSelect = document.getElementById(`trade-emp-${party.toLowerCase()}`);
    const daySelect = document.getElementById(`trade-day-${party.toLowerCase()}`);
    if (!empSelect || !daySelect) return;
    
    const empId = empSelect.value;

    if (!empId) {
      daySelect.innerHTML = '<option value="">Aguardando seleção...</option>';
      daySelect.disabled = true;
      document.getElementById('btn-execute-trade').disabled = true;
      return;
    }

    daySelect.innerHTML = '<option value="">Selecione o dia...</option>';
    daySelect.disabled = false;

    const empShifts = state.shifts[empId] || {};
    const cycleDays = getCycleDays(state.currentYear, state.currentMonth);

    let hasActiveShifts = false;

    cycleDays.forEach(dayInfo => {
      const dateStr = dayInfo.dateStr;
      const currentShift = empShifts[dateStr] || 'empty';

      if (currentShift !== 'F' && currentShift !== 'LM' && currentShift !== 'empty') {
        hasActiveShifts = true;
        const opt = document.createElement('option');
        opt.value = dateStr;
        
        const weekday = WEEKDAYS_SHORT[dayInfo.weekday];
        opt.textContent = `Dia ${dayInfo.label} (${weekday}) - Turno ${currentShift}`;
        daySelect.appendChild(opt);
      }
    });

    if (!hasActiveShifts) {
      daySelect.innerHTML = '<option value="">Sem plantões ativos este ciclo</option>';
      daySelect.disabled = true;
    }

    document.getElementById('btn-execute-trade').disabled = true;
  }

  // Simular e Validar Troca
  function handleValidateTrade() {
    const empIdA = document.getElementById('trade-emp-a').value;
    const dateStrA = document.getElementById('trade-day-a').value;
    const empIdB = document.getElementById('trade-emp-b').value;
    const dateStrB = document.getElementById('trade-day-b').value;

    const checklistContainer = document.getElementById('trade-validation-checklist');
    if (!checklistContainer) return;

    if (!empIdA || !dateStrA || !empIdB || !dateStrB) {
      showToast("Selecione os dois colaboradores e os turnos a ceder!", "danger");
      return;
    }

    if (empIdA === empIdB) {
      showToast("Não é possível trocar plantões do mesmo colaborador!", "danger");
      return;
    }

    const empA = state.employees.find(e => e.id === empIdA);
    const empB = state.employees.find(e => e.id === empIdB);

    const clonedShifts = JSON.parse(JSON.stringify(state.shifts));
    const tempShiftA = clonedShifts[empIdA][dateStrA];
    const tempShiftB = clonedShifts[empIdB][dateStrB];

    clonedShifts[empIdA][dateStrA] = tempShiftB;
    clonedShifts[empIdB][dateStrB] = tempShiftA;

    const simulatedViolations = validateCLTRules(clonedShifts, state.employees, state.currentYear, state.currentMonth);

    const violationsEmpA = simulatedViolations.filter(v => v.employeeId === empIdA);
    const violationsEmpB = simulatedViolations.filter(v => v.employeeId === empIdB);

    checklistContainer.innerHTML = '';
    
    let isTradeFeasible = true;

    // Teste 1: Descanso Interjornada de 11h (Colaborador A)
    const restViolationA = violationsEmpA.find(v => v.rule.includes("Interjornada"));
    appendValidationItem(
      checklistContainer, 
      !restViolationA, 
      `Intervalo de Descanso - ${empA.name}`,
      restViolationA ? restViolationA.description : `Regulamentado. O novo plantão preserva intervalo superior a 11 horas das jornadas adjacentes.`
    );
    if (restViolationA) isTradeFeasible = false;

    // Teste 2: Descanso Interjornada de 11h (Colaborador B)
    const restViolationB = violationsEmpB.find(v => v.rule.includes("Interjornada"));
    appendValidationItem(
      checklistContainer, 
      !restViolationB, 
      `Intervalo de Descanso - ${empB.name}`,
      restViolationB ? restViolationB.description : `Regulamentado. O novo plantão preserva intervalo superior a 11 horas das jornadas adjacentes.`
    );
    if (restViolationB) isTradeFeasible = false;

    // Teste 3: Limite de 6 Dias Seguidos (Colaborador A)
    const consecutiveViolationA = violationsEmpA.find(v => v.rule.includes("Consecutivo"));
    appendValidationItem(
      checklistContainer,
      !consecutiveViolationA,
      `Limite Trabalhista Semanal - ${empA.name}`,
      consecutiveViolationA ? consecutiveViolationA.description : `Conforme. O limite de 6 dias máximos de trabalho seguidos está respeitado.`
    );
    if (consecutiveViolationA) isTradeFeasible = false;

    // Teste 4: Limite de 6 Dias Seguidos (Colaborador B)
    const consecutiveViolationB = violationsEmpB.find(v => v.rule.includes("Consecutivo"));
    appendValidationItem(
      checklistContainer,
      !consecutiveViolationB,
      `Limite Trabalhista Semanal - ${empB.name}`,
      consecutiveViolationB ? consecutiveViolationB.description : `Conforme. O limite de 6 dias máximos de trabalho seguidos está respeitado.`
    );
    if (consecutiveViolationB) isTradeFeasible = false;

    // Teste 5: 12x36
    const rotViolationA = violationsEmpA.find(v => v.rule.includes("12x36"));
    const rotViolationB = violationsEmpB.find(v => v.rule.includes("12x36"));
    if (empA.scale === '12x36' || empB.scale === '12x36') {
      appendValidationItem(
        checklistContainer,
        (!rotViolationA && !rotViolationB),
        "Especificidades do Regime 12x36",
        (rotViolationA || rotViolationB) ? 
          `Violação de escala. Profissional em regime 12x36 não pode trabalhar em dias consecutivos sem descanso de 36h.` :
          "Respeitado. Ambos mantêm descanso alternado obrigatório."
      );
      if (rotViolationA || rotViolationB) isTradeFeasible = false;
    }

    const execBtn = document.getElementById('btn-execute-trade');
    if (execBtn) {
      if (isTradeFeasible) {
        execBtn.disabled = false;
        showToast("Troca validada! Nenhuma inconformidade legal identificada.", "success");
      } else {
        execBtn.disabled = true;
        showToast("Troca irregular! Ação violaria a CLT. Veja os detalhes ao lado.", "danger");
      }
    }
  }

  function appendValidationItem(container, isPassed, title, description) {
    const item = document.createElement('div');
    item.className = `validation-item ${isPassed ? 'passed' : 'failed'}`;
    
    item.innerHTML = `
      <div class="validation-item-icon">
        <span class="material-symbols-outlined">${isPassed ? 'check_circle' : 'cancel'}</span>
      </div>
      <div class="validation-details">
        <h5>${title}</h5>
        <p>${description}</p>
      </div>
    `;
    container.appendChild(item);
  }

  // Executar a Troca
  function handleExecuteTrade() {
    const empIdA = document.getElementById('trade-emp-a').value;
    const dateStrA = document.getElementById('trade-day-a').value;
    const empIdB = document.getElementById('trade-emp-b').value;
    const dateStrB = document.getElementById('trade-day-b').value;

    const empA = state.employees.find(e => e.id === empIdA);
    const empB = state.employees.find(e => e.id === empIdB);

    const tempShiftA = state.shifts[empIdA][dateStrA];
    const tempShiftB = state.shifts[empIdB][dateStrB];

    state.shifts[empIdA][dateStrA] = tempShiftB;
    state.shifts[empIdB][dateStrB] = tempShiftA;

    saveData();
    renderAll();
    
    document.getElementById('trade-emp-a').value = '';
    document.getElementById('trade-day-a').value = '';
    document.getElementById('trade-day-a').disabled = true;
    document.getElementById('trade-emp-b').value = '';
    document.getElementById('trade-day-b').value = '';
    document.getElementById('trade-day-b').disabled = true;
    document.getElementById('btn-execute-trade').disabled = true;
    
    document.getElementById('trade-validation-checklist').innerHTML = `
      <div class="validation-item neutral">
        <div class="validation-item-icon">
          <span class="material-symbols-outlined">hourglass_empty</span>
        </div>
        <div class="validation-details">
          <h5>Aguardando Configuração</h5>
          <p>Selecione os colaboradores e turnos para rodar a análise de conformidade jurídica.</p>
        </div>
      </div>
    `;

    showToast(`Plantão trocado com sucesso entre ${empA.name} e ${empB.name}!`, "success");
    
    setTimeout(() => {
      switchTab('escala');
    }, 1000);
  }

  // --- MODAIS ---
  function openModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.add('active');
  }

  function closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.remove('active');
  }

  window.closeModal = closeModal;

  // Editar Shift Manual
  function openEditShiftModal(employeeId, dateStr, currentShift, violation) {
    state.selectedCell = { employeeId, dateStr };
    
    const employee = state.employees.find(e => e.id === employeeId);
    if (!employee) return;

    const dateParts = dateStr.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    document.getElementById('modal-edit-title').textContent = `Alterar Plantão - ${employee.name}`;
    document.getElementById('modal-edit-subtitle').textContent = `Editar escala do dia ${formattedDate} (${employee.sector})`;
    
    const editSelect = document.getElementById('edit-shift-type');
    
    // Restrição Hierárquica do Técnico: Técnico só pode alterar para Folga (F), Licença (LM) ou Sem Turno (empty)
    if (state.currentUser && state.currentUser.role === 'tecnico') {
      editSelect.innerHTML = `
        <option value="F">F - Folga Programada</option>
        <option value="LM">LM - Licença Médica</option>
        <option value="empty">- Sem Turno Escalado</option>
      `;
    } else {
      // Admin e Enfermeiro possuem acesso a todas as opções
      editSelect.innerHTML = `
        <option value="M">M - Manhã (07h às 13h / 07h às 19h)</option>
        <option value="T">T - Tarde (13h às 19h)</option>
        <option value="N">N - Noite (19h às 07h)</option>
        <option value="F">F - Folga Programada</option>
        <option value="LM">LM - Licença Médica</option>
        <option value="empty">- Sem Turno Escalado</option>
      `;
    }

    editSelect.value = currentShift === 'empty' ? 'empty' : currentShift;

    const alertBox = document.getElementById('modal-edit-alert');
    if (violation) {
      alertBox.style.display = 'flex';
      document.getElementById('modal-edit-alert-text').textContent = violation.description;
    } else {
      alertBox.style.display = 'none';
    }

    openModal('modal-edit-shift');
  }

  // Salvar alteração manual
  function handleSaveShiftEdit() {
    if (!state.selectedCell) return;

    const { employeeId, dateStr } = state.selectedCell;
    const selectedShift = document.getElementById('edit-shift-type').value;

    if (!state.shifts[employeeId]) {
      state.shifts[employeeId] = {};
    }

    state.shifts[employeeId][dateStr] = selectedShift;

    saveData();
    closeModal('modal-edit-shift');
    
    renderAll();
    
    showToast("Turno atualizado com sucesso na matriz.", "success");
    state.selectedCell = null;
  }

  // --- UTILS ---
  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'danger') icon = 'error';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `
      <span class="material-symbols-outlined">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s ease-out reverse forwards';
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 300);
    }, 3700);
  }

  window.deleteEmployee = function (empId) {
    const employee = state.employees.find(e => e.id === empId);
    if (!employee) return;

    if (confirm(`Tem certeza que deseja remover ${employee.name} da equipe?`)) {
      state.employees = state.employees.filter(e => e.id !== empId);
      delete state.shifts[empId];

      saveData();
      populateSectorOptionsInForm();
      populateSectorFilters(); // Re-popular filtros de setores
      renderAll();
      showToast("Colaborador removido da base de dados.", "info");
    }
  };

  window.filterByEmployeeName = function (name) {
    document.getElementById('search-scale-employee').value = name;
    switchTab('escala');
  };

  // Inicialização ao carregar o DOM
  document.addEventListener('DOMContentLoaded', init);
})();

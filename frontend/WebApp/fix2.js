const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin/index.jsx', 'utf8');

const anchor1 = 'const [reportSms, setReportSms] = useState(false);';
const anchor2 = `    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;
        if (demoMode) return;
        
        if (mqttData) {`;

const missingLines = `    const [reportSubscribers, setReportSubscribers] = useState(false);
    
    // Residents & Templates
    const [residents, setResidents] = useState([]);
    const [isAddingResident, setIsAddingResident] = useState(false);
    const [newResidentState, setNewResidentState] = useState({ name: '', phone: '' });
    const [templates, setTemplates] = useState([]);
    const [editingTemplateType, setEditingTemplateType] = useState(null);
    const [templateDrafts, setTemplateDrafts] = useState({});
    
    // Formatters for user-friendly SMS templates
    const backendToUI = (str) => {
        if (!str) return '';
        return str
            .replace(/\\{level\\}/g, '[Current Water Height]')
            .replace(/\\{waterLevel\\}/g, '[Current Water Height]')
            .replace(/\\{status\\}/g, '[Alert Color]')
            .replace(/\\{timestamp\\}/g, '[Time Recorded]')
            .replace(/\\{name\\}/g, '[Resident Name]')
            .replace(/\\{otp\\}/g, '[OTP Code]')
            .replace(/\\{code\\}/g, '[OTP Code]')
            .replace(/\\{message\\}/g, '[Manual Message]')
            .replace(/\\[?%s\\]?/g, '[Time Recorded]');
    };

    const uiToBackend = (str) => {
        if (!str) return '';
        return str
            .replace(/\\[Current Water Height\\]/g, '{level}')
            .replace(/\\[Alert Color\\]/g, '{status}')
            .replace(/\\[Time Recorded\\]/g, '{timestamp}')
            .replace(/\\[Resident Name\\]/g, '{name}')
            .replace(/\\[OTP Code\\]/g, '{otp}')
            .replace(/\\[Manual Message\\]/g, '{message}');
    };

    const [searchTerm, setSearchTerm] = useState('');
    // Admin Users State
    const [adminUsers, setAdminUsers] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [datasetRequests, setDatasetRequests] = useState([]);
    // User Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', role: 'ADMIN' });

    // New Features State
    const [demoMode, setDemoMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [trendIndicators, setTrendIndicators] = useState({ waterLevel: '-', flowRate: '-' });
    const prevReadings = useRef({ waterLevel: null, flowRate: null });
    const [lastMqttAt, setLastMqttAt] = useState(null);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(null);
    const [evacuationSites, setEvacuationSites] = useState([]);
    const evacuationSitesRef = useRef([]);

    const displayName = user ? (user.fullName || user.username) : 'Admin';

    // -------------------------------------------------------------
    // DATA LOADING
    // -------------------------------------------------------------
    const loadDashboardData = async () => {
        try {
            const data = await fetchAlertStatus();
            const newDash = { ...dashData };
            newDash.waterLevel = (data.waterLevelM !== null && data.waterLevelM !== undefined) ? data.waterLevelM.toFixed(2) + ' m' : '--';

            const level = data.alertLevel || 'OFFLINE';
            newDash.status = level;
            if (level === 'RED') newDash.statusColor = 'text-red-600';
            else if (level === 'ORANGE') newDash.statusColor = 'text-orange-500';
            else if (level === 'YELLOW') newDash.statusColor = 'text-yellow-500';
            else if (level === 'GREEN') newDash.statusColor = 'text-green-600';
            else newDash.statusColor = 'text-slate-400';

            try {
                const res = await fetchActiveResidents();
                newDash.subscriberCount = res.length;
            } catch (e) { }

            setDashData(newDash);
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    };

    const loadCameraFeed = async () => {
        try {
            const data = await fetchCameraAPI();
            if (data.img_base64 && data.img_base64 !== "") setCameraImg(\`data:image/jpeg;base64,\${data.img_base64}\`);
        } catch (e) { console.error("Camera fetch error:", e); }
    };

    const loadTideData = async () => {
        try {
            const data = await fetchTidesData();
            if (data.extremes) {
                setTides(data.extremes);
                const now = new Date();
                const futureTides = data.extremes.filter(t => new Date(t.dt * 1000) > now);
                if (futureTides.length > 0) setNextTide(futureTides[0]);
            }
        } catch (e) { console.error(e); }
    };

    const loadChartData = async (hours) => {
        try {
            const data = await fetchSensorData(hours);
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setRawSensorData(data);
            
            if (data.length > 0) {
                const latest = data[data.length - 1];
                setDashData(prev => ({
                    ...prev,
                    flowRate: latest.sensorFlowRateMps !== null ? latest.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s',
                    prediction: latest.predictedLevel !== null ? latest.predictedLevel.toFixed(2) + ' m' : '-- m',
                }));
            }
        } catch (e) { console.error("Failed to update chart:", e); }
    };

    const loadResidents = async () => {
        try {
            const data = await fetchActiveResidents();
            setResidents(data);
        } catch (e) { console.error(e); }
    };

    const loadTemplates = async () => {
        try {
            const data = await fetchTemplatesAPI();
            const safe = Array.isArray(data) ? data : [];
            const order = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'OTP', 'MANUAL'];
            safe.sort((a, b) => {
                const ai = order.indexOf(String(a?.alertType || '').toUpperCase());
                const bi = order.indexOf(String(b?.alertType || '').toUpperCase());
                const ax = ai === -1 ? 999 : ai;
                const bx = bi === -1 ? 999 : bi;
                if (ax !== bx) return ax - bx;
                return String(a?.alertType || '').localeCompare(String(b?.alertType || ''));
            });
            setTemplates(safe);
            setTemplateDrafts(prev => {
                const next = { ...prev };
                safe.forEach(t => {
                    const key = String(t.alertType || '').toUpperCase();
                    if (next[key] === undefined) next[key] = t.template || '';
                });
                return next;
            });
        } catch (e) { console.error(e); }
    };

    const loadAdminUsersData = async () => {
        try {
            const users = await fetchAdminUsers();
            setAdminUsers(users);
            const logs = await fetchSystemLogs();
            setSystemLogs(logs);
        } catch (e) { console.error(e); }
    };

    const loadSystemLogsSafe = async () => {
        try {
            const logs = await fetchSystemLogs();
            setSystemLogs(logs);
        } catch (e) {
        }
    };

    const loadEvacuationSites = async () => {
        try {
            const sites = await fetchEvacuationSites();
            const safe = Array.isArray(sites) ? sites : [];
            evacuationSitesRef.current = safe;
            setEvacuationSites(safe);
        } catch (e) {
            evacuationSitesRef.current = [];
            setEvacuationSites([]);
        }
    };

    const loadDatasetRequests = async () => {
        try {
            const reqs = await fetchAllDatasetRequests();
            setDatasetRequests(reqs);
        } catch (e) { console.error(e); }
    };

    const handleUpdateDatasetStatus = async (id, status) => {
        try {
            await updateDatasetRequestStatus(id, status);
            loadDatasetRequests();
        } catch (e) {
            alert('Failed to update request status: ' + e.message);
        }
    };

    // -------------------------------------------------------------
    // EFFECTS
    // -------------------------------------------------------------
`;


code = code.replace(anchor1 + '\\n' + anchor2, anchor1 + '\\n' + missingLines + anchor2);

fs.writeFileSync('src/pages/Admin/index.jsx', code);
console.log("Restored missing chunks!");

const fs = require('fs');

const srcFile = 'src/pages/Admin.jsx';
let content = fs.readFileSync(srcFile, 'utf8');

['src/pages/Admin', 'src/pages/Admin/views', 'src/pages/Admin/components'].forEach(d => {
  if(!fs.existsSync(d)) fs.mkdirSync(d, {recursive: true});
});

// Helper Components
let dashStart = content.indexOf('function DashboardCard');
let healthStart = content.indexOf('function HealthRow');
let telStart = content.indexOf('function TelemetryCard');

let dashboardCardStr = content.substring(dashStart, healthStart);
let healthRowStr = content.substring(healthStart, telStart);
let telemetryCardStr = content.substring(telStart);

fs.writeFileSync('src/pages/Admin/components/DashboardCard.jsx', "import React from 'react';\n\n" + dashboardCardStr + "export default DashboardCard;\n");
fs.writeFileSync('src/pages/Admin/components/HealthRow.jsx', "import React from 'react';\n\n" + healthRowStr + "export default HealthRow;\n");
fs.writeFileSync('src/pages/Admin/components/TelemetryCard.jsx', "import React from 'react';\n\n" + telemetryCardStr.replace(/\}\s*$/, '}\nexport default TelemetryCard;\n'));

// Cut Helpers from Admin
let cutIdx = content.indexOf('// HELPER COMPONENTS');
if (cutIdx !== -1) {
    let headerStart = content.lastIndexOf('// ---', cutIdx);
    content = content.substring(0, headerStart !== -1 ? headerStart : cutIdx);
}

const views = [
    { id: 'dashboard', startToken: "{/* 1. DASHBOARD */}", endToken: "{/* 2. TELEMETRY & ANALYTICS */}", name: 'DashboardView' },
    { id: 'telemetry', startToken: "{/* 2. TELEMETRY & ANALYTICS */}", endToken: "{/* 3. AI PREDICTIONS & TIDES */}", name: 'TelemetryView' },
    { id: 'ai', startToken: "{/* 3. AI PREDICTIONS & TIDES */}", endToken: "{/* 4. RESIDENTS */}", name: 'AIView' },
    { id: 'residents', startToken: "{/* 4. RESIDENTS */}", endToken: "{/* 5. TEMPLATES */}", name: 'ResidentsView' },
    { id: 'templates', startToken: "{/* 5. TEMPLATES */}", endToken: "{/* DATASET REQUESTS */}", name: 'TemplatesView' },
    { id: 'datasets', startToken: "{/* DATASET REQUESTS */}", endToken: "{/* 6. REPORTS */}", name: 'DatasetsView' },
    { id: 'reports', startToken: "{/* 6. REPORTS */}", endToken: "{/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}", name: 'ReportsView' },
    { id: 'admin_users', startToken: "{/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}", endToken: "</main>", name: 'AdminUsersView' }
];

const PROPS_STRING = `demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, handleDeleteAllTemplates, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, handleApproveDataset, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, handleDeleteAdminUser, showUserModal, userForm, handleSaveAdminUser, systemLogs, activeView`;

let importsStr = `import DashboardCard from './components/DashboardCard';\nimport HealthRow from './components/HealthRow';\nimport TelemetryCard from './components/TelemetryCard';\n`;

for(let v of views) {
    let sIdx = content.indexOf(v.startToken);
    let eIdx = content.indexOf(v.endToken);
    if(sIdx === -1 || eIdx === -1) { console.log("Missing boundary for " + v.name); continue; }
    
    let block = content.substring(sIdx, eIdx);
    
    // Instead of stripping anything matching `)}`, we only remove the literal wrapping `{activeView === ... && (` and the trailing `}` down the end.
    // The safest way is to find the first `{activeView === '${v.id}' && (` and remove it.
    let wrapperStr = `{activeView === '${v.id}' && (`;
    let wIdx = block.indexOf(wrapperStr);
    let innerBlock = block;
    if(wIdx !== -1) {
        innerBlock = block.substring(0, wIdx) + block.substring(wIdx + wrapperStr.length);
        // Find the last `)}` and replace with ''
        let lastIdx = innerBlock.lastIndexOf(')}');
        if(lastIdx !== -1) {
            innerBlock = innerBlock.substring(0, lastIdx) + innerBlock.substring(lastIdx + 2);
        }
    }
    
    let fileContent = `import React from 'react';\nimport { Line } from 'react-chartjs-2';\nimport DashboardCard from '../components/DashboardCard';\nimport HealthRow from '../components/HealthRow';\nimport TelemetryCard from '../components/TelemetryCard';\n\nexport default function ${v.name}(props) {\n  const { ${PROPS_STRING} } = props;\n\n  return (\n<>\n${innerBlock}\n</>\n  );\n}\n`;
    
    fs.writeFileSync(`src/pages/Admin/views/${v.name}.jsx`, fileContent);
    
    content = content.replace(block, `${v.startToken}\n{activeView === '${v.id}' && <${v.name} {...viewProps} />}\n`);
    
    importsStr += `import ${v.name} from './views/${v.name}';\n`;
}

// Add viewProps generation in the main render
let mainStart = content.indexOf('<main className="flex-1 overflow-y-auto');
content = content.substring(0, mainStart) + '<main className="flex-1 overflow-y-auto relative w-full pt-6 pb-12 px-8">\n' + 
    `{(() => { const viewProps = { ${PROPS_STRING} }; return (<>\n` + 
    content.substring(mainStart + '<main className="flex-1 overflow-y-auto relative w-full pt-6 pb-12 px-8">'.length);

content = content.replace('</main>', '</>\n                );\n                })()}\n            </main>');

// Replace imports depth if any exist relative to pages
content = content.replace(/import \{ getUser, clearUser \} from '\.\.\/services/g, "import { getUser, clearUser } from '../../services");
content = content.replace(/from '\.\.\/hooks/g, "from '../../hooks");
content = content.replace(/from '\.\.\/services/g, "from '../../services");

content = content.replace('export default function Admin()', importsStr + '\nexport default function Admin()');

fs.writeFileSync('src/pages/Admin/index.jsx', content);

let appContent = fs.readFileSync('src/App.jsx', 'utf8');
appContent = appContent.replace("import Admin from './pages/Admin.jsx';", "import Admin from './pages/Admin/index.jsx';");
fs.writeFileSync('src/App.jsx', appContent);

fs.unlinkSync('src/pages/Admin.jsx');
console.log('Done!');

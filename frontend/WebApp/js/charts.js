import { API_BASE_URL } from './config.js';

let waterChartInstance = null;

// Initialize the chart container and settings
export async function initWaterLevelChart() {
    const ctx = document.getElementById('waterLevelChart');
    if (!ctx) return;

    // Destroy previous instance if exists to prevent canvas overlay glitches
    if (waterChartInstance) {
        waterChartInstance.destroy();
    }

    waterChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Time labels
            datasets: [{
                label: 'Water Level (Meters)',
                data: [], // Data points
                borderColor: '#3b82f6', // Tailwind Blue-500
                backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue fill
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Level: ${context.parsed.y.toFixed(2)} m`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 12 }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Meters' },
                    grid: { borderDash: [2, 4] }
                }
            }
        }
    });

    // Load initial data
    await updateChartData();
}

// Fetch data from Backend and update chart
export async function updateChartData() {
    if (!waterChartInstance) return;

    try {
        // Fetch last 24 hours of data from Backend
        const response = await fetch(`${API_BASE_URL}/sensor-data/recent?hours=24`);
        if (!response.ok) return;

        const data = await response.json();

        // 1. Sort data by time (Oldest -> Newest)
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 2. Process Data for Chart.js
        const labels = data.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });

        const values = data.map(d => d.waterLevelM);

        // 3. Update Chart
        waterChartInstance.data.labels = labels;
        waterChartInstance.data.datasets[0].data = values;
        waterChartInstance.update('none'); // 'none' mode prevents full re-animation flickering

    } catch (error) {
        console.error("Failed to update chart:", error);
    }
}
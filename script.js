let autocomplete;
let climateData = null;
let csvData = null;
const API_KEY = 'YOUR_GOOGLE_API_KEY'; // Substitua pela sua chave de API do Google
const CX = 'YOUR_CUSTOM_SEARCH_ENGINE_ID'; // Substitua pelo seu ID do mecanismo de pesquisa personalizado

function initMap() {
    const input = document.getElementById('location');
    autocomplete = new google.maps.places.Autocomplete(input);

    // Adiciona um listener para lidar com a seleção de um lugar
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            alert("Por favor, selecione uma localização válida.");
            return;
        }
    });
}

function loadCSV(event) {
    const file = event.target.files[0];
    if (file) {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            complete: function(results) {
                csvData = results.data;
                console.log('Dados CSV carregados:', csvData); // Log para depuração
                displayCSVData(csvData);
            },
            error: function(error) {
                console.error('Erro ao carregar o arquivo CSV:', error);
                alert('Erro ao carregar o arquivo CSV. Por favor, tente novamente.');
            }
        });
    }
}

function displayCSVData(data) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '<h2>Dados do CSV:</h2>';
    outputDiv.innerHTML += `
        <table>
            <tr>
                ${Object.keys(data[0]).map(key => `<th>${key}</th>`).join('')}
            </tr>
    `;
    data.forEach(row => {
        outputDiv.innerHTML += `
            <tr>
                ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
            </tr>
        `;
    });
    outputDiv.innerHTML += '</table>';
}

async function fetchClimateDataFromNASA(latitude, longitude, startDate, endDate) {
    try {
        const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOT,T2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${longitude}&latitude=${latitude}&start=${startDate}&end=${endDate}&format=JSON`);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados climáticos da NASA');
        }
        const data = await response.json();
        console.log('Dados climáticos recebidos:', data); // Log para depuração
        return {
            precipitation: data.properties.parameter.PRECTOT,
            temperature: data.properties.parameter.T2M,
            humidity: data.properties.parameter.ALLSKY_SFC_SW_DWN
        };
    } catch (error) {
        console.error('Erro ao buscar dados climáticos:', error);
        alert('Erro ao buscar dados climáticos. Por favor, tente novamente mais tarde.');
        return null;
    }
}

async function fetchCropConditions() {
    const cropType = document.getElementById('cropType').value;
    if (!cropType) return;

    try {
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(cropType)}&cx=${CX}&key=${API_KEY}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar informações sobre a cultura no Google');
        }
        const data = await response.json();
        console.log('Dados da cultura recebidos:', data); // Log para depuração
        displayCropConditions(data);
    } catch (error) {
        console.error('Erro ao buscar informações sobre a cultura no Google:', error);
        alert('Erro ao buscar informações sobre a cultura. Por favor, tente novamente mais tarde.');
    }
}

function displayCropConditions(data) {
    const cropConditionsDiv = document.getElementById('cropConditions');
    cropConditionsDiv.innerHTML = '<h2>Informações sobre a Cultura:</h2>';
    data.items.forEach(item => {
        cropConditionsDiv.innerHTML += `<p><a href="${item.link}" target="_blank">${item.title}</a>: ${item.snippet}</p>`;
    });
}

async function fetchData() {
    const cropType = sanitizeInput(document.getElementById('cropType').value);
    const location = sanitizeInput(document.getElementById('location').value);
    const startDate = sanitizeInput(document.getElementById('startDate').value.replace(/-/g, ''));
    const endDate = sanitizeInput(document.getElementById('endDate').value.replace(/-/g, ''));
    const minTemp = sanitizeInput(document.getElementById('minTemp').value);
    const maxTemp = sanitizeInput(document.getElementById('maxTemp').value);

    if (!cropType || !location || !startDate || !endDate || !minTemp || !maxTemp) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    const place = autocomplete.getPlace();
    if (!place || !place.geometry) {
        alert("Por favor, selecione uma localização válida.");
        return;
    }
    const latitude = place.geometry.location.lat();
    const longitude = place.geometry.location.lng();

    climateData = await fetchClimateDataFromNASA(latitude, longitude, startDate, endDate);
    if (!climateData) {
        return;
    }

    // Exibir dados climáticos
    displayClimateData(climateData);

    // Analisar dados climáticos para determinar a melhor data de colheita
    const bestHarvestDate = analyzeData(climateData, minTemp, maxTemp);

    // Armazenar informações no histórico
    storeData({ cropType, location, startDate, endDate, minTemp, maxTemp, bestHarvestDate });

    // Buscar condições da cultura
    await fetchCropConditions();

    document.getElementById('output').innerText += `\nMelhor data de colheita: ${bestHarvestDate.date}\nMotivo: ${bestHarvestDate.reason}`;
}

function displayClimateData(data) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '<h2>Dados Climáticos:</h2>';
    outputDiv.innerHTML += `
        <table>
            <tr>
                <th>Data</th>
                <th>Temperatura (°C)</th>
                <th>Umidade (%)</th>
                <th>Precipitação (mm)</th>
            </tr>
    `;
    for (const date in data.temperature) {
        outputDiv.innerHTML += `
            <tr>
                <td>${date}</td>
                <td>${data.temperature[date]}</td>
                <td>${data.humidity[date]}</td>
                <td>${data.precipitation[date]}</td>
            </tr>
        `;
    }
    outputDiv.innerHTML += '</table>';
}

function analyzeData(data, minTemp, maxTemp) {
    let bestDate = null;
    let bestScore = -Infinity;
    let reason = '';

    for (const [date, temperature] of Object.entries(data.temperature)) {
        const score = calculateHarvestScore(temperature, minTemp, maxTemp);
        if (score > bestScore) {
            bestScore = score;
            bestDate = date;
            reason = `Temperatura de ${temperature} °C, ideal para a colheita.`;
        }
    }

    return { date: bestDate, reason: reason };
}

function calculateHarvestScore(temperature, minTemp, maxTemp) {
    const temperatureDifference = Math.min(Math.abs(temperature - minTemp), Math.abs(temperature - maxTemp));
    return -temperatureDifference; // Quanto menor a diferença, melhor a pontuação
}

function storeData(data) {
    let history = JSON.parse(localStorage.getItem('history')) || [];
    history.push(data);
    localStorage.setItem('history', JSON.stringify(history));
}

function sanitizeInput(input) {
    const element = document.createElement('div');
    element.innerText = input;
    return element.innerHTML;
}

function reloadPage() {
    window.location.reload();
}

window.onload = initMap;
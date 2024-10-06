let autocomplete;

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

async function fetchClimateDataFromNASA(latitude, longitude, startDate, endDate) {
    try {
        const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=AG&longitude=${longitude}&latitude=${latitude}&start=${startDate}&end=${endDate}&format=JSON`);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados climáticos da NASA');
        }
        const data = await response.json();
        return data.properties.parameter.T2M;
    } catch (error) {
        console.error('Erro ao buscar dados climáticos:', error);
        alert('Erro ao buscar dados climáticos. Por favor, tente novamente mais tarde.');
        return null;
    }
}

async function fetchData() {
    const cropType = sanitizeInput(document.getElementById('cropType').value);
    const location = sanitizeInput(document.getElementById('location').value);
    const startDate = sanitizeInput(document.getElementById('startDate').value.replace(/-/g, ''));
    const endDate = sanitizeInput(document.getElementById('endDate').value.replace(/-/g, ''));

    if (!cropType || !location || !startDate || !endDate) {
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

    const climateData = await fetchClimateDataFromNASA(latitude, longitude, startDate, endDate);
    if (!climateData) {
        return;
    }

    // Exibir dados climáticos
    displayClimateData(climateData);

    // Analisar dados climáticos para determinar a melhor data de colheita
    const bestHarvestDate = analyzeData(climateData);

    // Armazenar informações no histórico
    storeData({ cropType, location, startDate, endDate, bestHarvestDate });

    document.getElementById('output').innerText += `\nMelhor data de colheita: ${bestHarvestDate.date}\nMotivo: ${bestHarvestDate.reason}`;
}

function displayClimateData(data) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '<h2>Dados Climáticos:</h2>';
    for (const [date, temperature] of Object.entries(data)) {
        outputDiv.innerHTML += `<p>Data: ${date}, Temperatura: ${temperature}°C</p>`;
    }
}

function analyzeData(data) {
    let bestDate = null;
    let bestScore = -Infinity;
    let reason = '';

    for (const [date, temperature] of Object.entries(data)) {
        const score = calculateHarvestScore(temperature);
        if (score > bestScore) {
            bestScore = score;
            bestDate = date;
            reason = `Temperatura média de ${temperature}°C, ideal para a colheita.`;
        }
    }

    return { date: bestDate, reason: reason };
}

function calculateHarvestScore(temperature) {
    const idealTemperature = 25; // Exemplo de temperatura ideal
    const temperatureDifference = Math.abs(temperature - idealTemperature);
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

function obterTemperatura() {
    const cultura = document.getElementById('cultura').value.toLowerCase();
    const temperaturas = {
        "soja": "A soja se desenvolve bem entre 20°C e 30°C, sendo que temperaturas muito acima de 35°C podem prejudicar a produção.",
        "milho": "O milho prospera em temperaturas entre 18°C e 30°C, com a faixa ideal para o crescimento vegetativo entre 24°C e 30°C.",
        "sorgo": "O sorgo se desenvolve melhor entre 25°C e 30°C, sendo tolerante a altas temperaturas.",
        "cana-de-açúcar": "A cana-de-açúcar prefere temperaturas entre 25°C e 30°C, com crescimento ótimo entre 26°C e 33°C.",
        "algodão": "O algodão cresce bem em temperaturas entre 25°C e 35°C, com uma temperatura ideal em torno de 30°C.",
        "feijão": "O feijão se desenvolve melhor entre 18°C e 28°C, sendo sensível a extremos de calor ou frio.",
        "pastagens": "Pastagens variam dependendo da espécie; forrageiras tropicais preferem entre 25°C e 30°C.",
        "café": "O café prefere temperaturas entre 18°C e 24°C, com extremos podendo comprometer a produção.",
        "trigo": "O trigo prospera entre 15°C e 25°C, com limites críticos acima de 30°C durante a fase de enchimento dos grãos.",
        "amendoim": "O amendoim cresce melhor entre 25°C e 30°C, sendo sensível a temperaturas muito altas ou baixas.",
        "eucalipto": "O eucalipto se desenvolve bem em temperaturas entre 18°C e 30°C, dependendo da espécie.",
        "laranja": "A laranja cresce melhor entre 23°C e 32°C, com extremos prejudicando o desenvolvimento.",
        "girassol": "O girassol prefere temperaturas entre 20°C e 30°C, com calor excessivo reduzindo a produção de óleo.",
        "cevada": "A cevada prospera entre 15°C e 25°C, com altas temperaturas prejudicando a qualidade do grão.",
        "uva": "A uva prefere temperaturas entre 18°C e 28°C, com calor excessivo prejudicando a qualidade dos frutos.",
        "banana": "A banana se desenvolve melhor entre 26°C e 30°C, com crescimento limitado abaixo de 15°C e acima de 35°C.",
        "tabaco": "O tabaco prospera entre 20°C e 30°C, com crescimento ótimo em torno de 27°C."
    };

    const resultado = temperaturas[cultura] || "Cultura não encontrada. Tente outra.";
    document.getElementById('resultado').innerHTML = resultado;
}

function reloadPage() {
    window.location.reload();
}

window.onload = initMap;
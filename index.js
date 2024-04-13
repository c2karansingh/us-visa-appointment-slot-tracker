const HEADERS_FROM_BROWSER = {
    "accept": "application/json, text/javascript, */*; q=0.01",
};

const YOUR_CURRENT_DATE = "2025-19-12";
const INTERVAL_BETWEEN_REQUESTS_IN_MILLISECONDS = 1000 * 1;
const INTERVAL_BEFORE_REPEATING_REQUESTS_IN_MILLISECONDS = 1000 * 30;


const BASE_URL = 'https://ais.usvisa-info.com/en-ca/niv/schedule/54914036/appointment/days/';
const LOCATION_PATH_MAP = {
    'Calgary': '89.json',
    'Halifax': '90.json',
    'Montreal': '91.json',
    'Ottawa': '92.json',
    'Quebec City': '93.json',
    'Toronto': '94.json',
    'Vancouver': '95.json',
};

function beep(duration = 200, frequency = 440, volume = 1, type = 'sine') {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audioContext.createOscillator();
    let gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = volume;
    oscillator.frequency.value = frequency;
    oscillator.type = type;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + (duration * 0.001));
};


const getAvailableDates = async (location) => {
    const locationPath = LOCATION_PATH_MAP[location];
    if (!locationPath) {
        throw new Error('Invalid location');
    }

    const url = `${BASE_URL}${locationPath}?appointments[expedite]=false`;

    const response = await fetch(url, {
        "headers": HEADERS_FROM_BROWSER,
        "body": null,
        "method": "GET"
    });

    if (!response.ok && response.status >= 500 && response.status < 600) {
        throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
};


(
    async () => {
        const allLocations = Object.keys(LOCATION_PATH_MAP);
        const intervalCode = setInterval(
            async () => {
                for (const location of allLocations) {
                    try {
                        console.log(`Checking location: ${location}`);
                        const availableDates = await getAvailableDates(location);
                        console.log(availableDates);
                        for (const availableDate of availableDates) {
                            if (availableDate.date < YOUR_CURRENT_DATE) {
                                beep(1000, 3000, 5);
                                alert(`Location: ${location}, Date: ${availableDate.date}`);
                                clearInterval(intervalCode);
                            }
                        }
                        await new Promise((resolve) => setTimeout(resolve, INTERVAL_BETWEEN_REQUESTS_IN_MILLISECONDS));
                    }
                    catch (error) {
                        console.log(`Error occurred while checking location: ${location}`);
                        console.log(JSON.stringify(error));
                        console.log(error);
                        console.log(error.message);
                        if (error.message.startsWith("Server error") || error instanceof TypeError) {
                            continue; // Continue execution to try again later
                        }
                        console.log('Stopping the interval');
                        beep(1000, 100, 5); // This will beep for any error.
                        clearInterval(intervalCode);
                        return; // Exit the function on critical errors
                    }
                }
                // clear the current output in the browser console
                console.clear();
                //logging local date time to console
                console.log(new Date().toLocaleString());
            },
            INTERVAL_BEFORE_REPEATING_REQUESTS_IN_MILLISECONDS
        );
    }
)();

#!/usr/bin/env node

import axios from 'axios';
import cheerio from 'cheerio';
import { clear, log } from 'console';
import { exit } from 'process';
import { exec } from "child_process";

const CURRENT_BOOKED_DATE = "2027-09-05"


const USERNAME = process.env.USERNAME
const PASSWORD = process.env.PASSWORD
const SCHEDULE_ID = process.env.SCHEDULE_ID

if (!USERNAME || !PASSWORD || !SCHEDULE_ID) {
    throw new Error("Please provide USERNAME, PASSWORD and SCHEDULE_ID as environment variables")
}

const BASE_URI = 'https://ais.usvisa-info.com/en-ca/niv'

const LOCATION_PATH_MAP = {
    'Calgary': '89',
    'Halifax': '90',
    'Montreal': '91',
    'Ottawa': '92',
    'Quebec City': '93',
    'Toronto': '94',
    'Vancouver': '95',
};
const commonHeaders = {
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Google Chrome\";v=\"123\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"123\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "x-requested-with": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};


async function main(CURRENT_BOOKED_DATE) {
    log(`Initializing with current date ${CURRENT_BOOKED_DATE}`)
    try {
        log("Logging in")
        const authenticatedHeaders = await login()
        log("Getting scheduling info")
        const authenticatedSchedulingHeaders = await getAppointSchedulingInfo(authenticatedHeaders)
        while (true) {
            for (const location in LOCATION_PATH_MAP) {
                log(`Checking ${location}`)
                const availableDates = await checkAvailableDate(authenticatedSchedulingHeaders, location)
                log(`earliest available date at ${location}: ${availableDates.length === 0 ? "N/A" : availableDates[0].date}`)
                if (availableDates.length !==0 && availableDates[0].date < CURRENT_BOOKED_DATE) {
                    log(`found earlier date at ${location}: ${availableDates[0].date}`);
                    const availableTimes = await checkAvailableTime(authenticatedSchedulingHeaders, location, availableDates[0].date)
                    if(availableTimes.length === 0) {
                        log(`No available times for ${availableDates[0].date}`)
                        continue;
                    }
                    exec("afplay /System/Library/Sounds/Submarine.aiff");
                    await book(authenticatedSchedulingHeaders, location, availableDates[0].date, availableTimes.business_times[0]);
                    log(`Booked time at ${availableDates[0].date} ${availableTimes.business_times[0]}`)
                    exit(0)
                }
            }
            log("No earlier dates found, sleeping for 5 seconds")
            await new Promise(resolve => setTimeout(resolve, 5 * 1000))
            clear()
        }

    } catch (err) {
        exec("afplay /System/Library/Sounds/Submarine.aiff");
        console.error(err)
    }
}

async function login() {
    const anonymousLoginPageResponse = await axios.get(`${BASE_URI}/users/sign_in`)
    const $ = cheerio.load(anonymousLoginPageResponse.data)
    const csrfToken = $('meta[name="csrf-token"]').attr('content')


    const loginRequestHeaders = {
        ...commonHeaders,
        "accept": "*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://ais.usvisa-info.com/en-ca/niv/users/sign_in",
        // @ts-ignore
        "cookie": anonymousLoginPageResponse.headers['set-cookie'][0].split(';')[0],
        "x-csrf-token": csrfToken
    };

    const loginRequestParams = new URLSearchParams();
    // @ts-ignore
    loginRequestParams.append('user[email]', USERNAME);
    // @ts-ignore
    loginRequestParams.append('user[password]', PASSWORD);
    loginRequestParams.append('policy_confirmed', "1");
    loginRequestParams.append('commit', 'Sign In');
    const bodyStringified = loginRequestParams.toString();

    const loginResponse = await axios.post(`${BASE_URI}/users/sign_in`, bodyStringified, {
        headers: loginRequestHeaders
    });
    return {
        // @ts-ignore
        "cookie": loginResponse.headers['set-cookie'][0].split(';')[0],
        "x-csrf-token": csrfToken
    };
}

async function getAppointSchedulingInfo(authenticatedHeaders) {
    const requestHeaders = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Referer": "https://ais.usvisa-info.com/en-ca/niv/schedule/54914036/continue_actions",
        "Host": "ais.usvisa-info.com",
        ...commonHeaders,
        ...authenticatedHeaders
    };
    const schedulingPageResponse = await axios.get(`${BASE_URI}/schedule/${SCHEDULE_ID}/appointment`, {
        headers: requestHeaders
    })
    const $ = cheerio.load(schedulingPageResponse.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content')
    return {
        // @ts-ignore
        "cookie": schedulingPageResponse.headers['set-cookie'][0].split(';')[0],
        "x-csrf-token": csrfToken
    }
}

async function checkAvailableDate(authenticatedSchedulingHeaders, location) {
    const url = `${BASE_URI}/schedule/${SCHEDULE_ID}/appointment/days/${LOCATION_PATH_MAP[location]}.json?appointments[expedite]=false`
    const headers = {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://ais.usvisa-info.com/en-ca/niv/schedule/54914036/appointment",
        "Accept-Encoding": "gzip, deflate, br",
        "Host": "ais.usvisa-info.com",
        ...commonHeaders,
        ...authenticatedSchedulingHeaders
    }
    const dates = await axios.get(url, {
        headers
    })

    return dates.data;
}

async function checkAvailableTime(authenticatedSchedulingHeaders, location, date) {
    const url = `${BASE_URI}/schedule/${SCHEDULE_ID}/appointment/times/${LOCATION_PATH_MAP[location]}.json?appointments[expedite]=false&date=${date}`
    const headers = {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://ais.usvisa-info.com/en-ca/niv/schedule/54914036/appointment",
        "Accept-Encoding": "gzip, deflate, br",
        "Host": "ais.usvisa-info.com",
        ...commonHeaders,
        ...authenticatedSchedulingHeaders
    }
    const times = await axios.get(url, {
        headers
    })

    return times.data;
}

async function book(authenticatedSchedulingHeaders, location, date, time) {
    const url = `${BASE_URI}/schedule/${SCHEDULE_ID}/appointment`
    const headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Referer": "https://ais.usvisa-info.com/en-ca/niv/schedule/54914036/appointment",
        "Host": "ais.usvisa-info.com",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...commonHeaders,
        ...authenticatedSchedulingHeaders
    }
    const body = new URLSearchParams();
    body.append('authenticity_token', authenticatedSchedulingHeaders['x-csrf-token']);
    body.append('confirmed_limit_message', '1');
    body.append('use_consulate_appointment_capacity', 'true');
    body.append('appointments[consulate_appointment][facility_id]', LOCATION_PATH_MAP[location]);
    body.append('appointments[consulate_appointment][date]', date);
    body.append('appointments[consulate_appointment][time]', time);
    // body.append('appointments[asc_appointment][facility_id]', '');
    // body.append('appointments[asc_appointment][date]', '');
    // body.append('appointments[asc_appointment][time]', '');

    const bodyStringified = body.toString();

    log(`Booking appointment at ${location} on ${date} at ${time}`)
    log(`bodyStringified: ${bodyStringified}`)
    log(`headers: ${JSON.stringify(headers)}`)
    log(`url: ${url}`)

    const response = await axios.post(url, bodyStringified, {
        headers
    })

    log(`response: ${response.data}`)

    return response.data;
}

main(CURRENT_BOOKED_DATE)

export { login, getAppointSchedulingInfo, checkAvailableDate, checkAvailableTime}

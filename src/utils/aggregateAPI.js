import { extractTotalProductionCredit } from './extractFields';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function quarterOfMonth(monthIndex) {
  return Math.floor(monthIndex / 3) + 1;
}

function quarterMonthRange(quarter) {
  const start = (quarter - 1) * 3;
  return [MONTHS_SHORT[start], MONTHS_SHORT[start + 2]];
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function lastDayOfQuarter(year, quarter) {
  const lastMonthIndex = (quarter - 1) * 3 + 2;
  return new Date(Date.UTC(year, lastMonthIndex + 1, 0));
}

function daysBetween(fromDate, toDate) {
  const from = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to   = Date.UTC(toDate.getFullYear(),   toDate.getMonth(),   toDate.getDate());
  return Math.max(0, Math.round((to - from) / MS_PER_DAY));
}

function getMostRecentSundayISO(date) {
  const day = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  return sunday.toISOString().slice(0, 10);
}

function isInPeriod(weekStartingISO, currentDate, period) {
  if (!weekStartingISO || typeof weekStartingISO !== 'string') return false;
  if (weekStartingISO.length < 10) return false;

  const year     = parseInt(weekStartingISO.slice(0, 4), 10);
  const month    = parseInt(weekStartingISO.slice(5, 7), 10);
  const curYear  = currentDate.getFullYear();
  const curMonth = currentDate.getMonth() + 1;

  if (period === 'ytd')     return year === curYear;
  if (period === 'month')   return year === curYear && month === curMonth;
  if (period === 'quarter') return year === curYear && quarterOfMonth(month - 1) === quarterOfMonth(curMonth - 1);
  if (period === 'week')    return weekStartingISO === getMostRecentSundayISO(currentDate);

  return false;
}

function sumApiSold(submissions, currentDate, period) {
  return submissions
    .filter((s) => s?.status === 'submitted' && isInPeriod(s.weekStarting, currentDate, period))
    .reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);
}

function buildSlice(current, target, period, status) {
  const safeTarget = target > 0 ? target : 0;
  const percent = safeTarget > 0 ? Math.round((current / safeTarget) * 100) : 0;
  return { current, target: safeTarget, percent, period, status };
}

export function aggregateAPI(submissions = [], currentDate = new Date(), personalAnnualAPI = 200000) {
  const target = parseFloat(personalAnnualAPI) || 0;
  const year   = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const quarter  = quarterOfMonth(monthIdx);

  // Week — find most-recent Sunday and the next Saturday for status text
  const sundayISO    = getMostRecentSundayISO(currentDate);
  const sundayDate   = new Date(`${sundayISO}T00:00:00Z`);
  const saturdayUTC  = new Date(sundayDate.getTime() + 6 * MS_PER_DAY);
  const saturdayDate = new Date(saturdayUTC.getUTCFullYear(), saturdayUTC.getUTCMonth(), saturdayUTC.getUTCDate());
  const weekDaysLeft = daysBetween(currentDate, saturdayDate);
  const weekLabel    = `Week of ${MONTHS_SHORT[sundayDate.getUTCMonth()]} ${sundayDate.getUTCDate()}`;
  const weekStatus   = weekDaysLeft > 0
    ? `${weekDaysLeft} ${weekDaysLeft === 1 ? 'day' : 'days'} remaining this week`
    : 'Final day of the week';

  // Month
  const monthEndDay  = lastDayOfMonth(year, monthIdx);
  const monthEndDate = new Date(year, monthIdx, monthEndDay);
  const monthDaysLeft = daysBetween(currentDate, monthEndDate);
  const monthLabel    = `${MONTHS_SHORT[monthIdx]} ${year} · Month-to-Date`;
  const monthStatus   = monthDaysLeft > 0
    ? `${monthDaysLeft} ${monthDaysLeft === 1 ? 'day' : 'days'} remaining in month`
    : 'Final day of the month';

  // Quarter
  const quarterEnd        = lastDayOfQuarter(year, quarter);
  const quarterEndLocal   = new Date(quarterEnd.getUTCFullYear(), quarterEnd.getUTCMonth(), quarterEnd.getUTCDate());
  const quarterDaysLeft   = daysBetween(currentDate, quarterEndLocal);
  const [qStart, qEnd]    = quarterMonthRange(quarter);
  const quarterLabel      = `Q${quarter} ${year} · ${qStart} — ${qEnd}`;
  const quarterStatus     = quarterDaysLeft > 0
    ? `${quarterDaysLeft} ${quarterDaysLeft === 1 ? 'day' : 'days'} remaining in quarter`
    : 'Final day of the quarter';

  // YTD
  const yearEnd     = new Date(year, 11, 31);
  const ytdDaysLeft = daysBetween(currentDate, yearEnd);
  const ytdLabel    = `${year} Year-to-Date`;
  const ytdStatus   = ytdDaysLeft > 0
    ? `${ytdDaysLeft} ${ytdDaysLeft === 1 ? 'day' : 'days'} remaining this year`
    : 'Final day of the year';

  return {
    week:    buildSlice(sumApiSold(submissions, currentDate, 'week'),    target / 52, weekLabel,    weekStatus),
    month:   buildSlice(sumApiSold(submissions, currentDate, 'month'),   target / 12, monthLabel,   monthStatus),
    quarter: buildSlice(sumApiSold(submissions, currentDate, 'quarter'), target / 4,  quarterLabel, quarterStatus),
    ytd:     buildSlice(sumApiSold(submissions, currentDate, 'ytd'),     target,      ytdLabel,     ytdStatus),
  };
}

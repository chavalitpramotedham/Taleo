/**
 * How a page decides between day and night as it opens: by the clock on
 * the reader's own device. Daylight from 9 in the morning until 7 in the
 * evening; night the rest of the time.
 *
 * The switch in the menu bar still has the last word, but only for the
 * stretch of day or night it was pressed in: a parent who turns the lights
 * off at bedtime finds daylight again the next morning, and one who turns
 * them on in the evening gets night back the following evening.
 */
export const DAY_STARTS = 9; // 9:00
export const DAY_ENDS = 19; // 19:00 (7 in the evening)

export const NIGHT_KEY = "taleo.night";
/** When the switch was last pressed (ms), so a choice can lapse. */
export const NIGHT_AT_KEY = "taleo.night.at";

/** Run before the first paint (inline, in the page's head), so a page never
 *  flashes the wrong theme. (public/offline.html carries its own copy.) */
export const NIGHT_INIT = `try{(function(){var d=new Date(),h=d.getHours(),day=h>=${DAY_STARTS}&&h<${DAY_ENDS},s=new Date(d),on=!day;s.setMinutes(0,0,0);if(day)s.setHours(${DAY_STARTS});else{if(h<${DAY_ENDS})s.setDate(s.getDate()-1);s.setHours(${DAY_ENDS})}try{var v=localStorage.getItem("${NIGHT_KEY}"),at=+localStorage.getItem("${NIGHT_AT_KEY}")||0;if((v==="1"||v==="0")&&at>=s.getTime())on=v==="1"}catch(e){}if(on){document.documentElement.dataset.night="1";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="#1a1925"}})()}catch(e){}`;

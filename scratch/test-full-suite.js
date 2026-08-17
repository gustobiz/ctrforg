const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 1. Test Schedule Utils
const { 
  calculateNextEligibleSendTime, 
  isDateInsideSendWindow, 
  calculateFollowupScheduledTime, 
  formatTime24To12,
  getTimePartsInTimezone 
} = require('../src/lib/gmail/schedule-utils.ts');

console.log('=== RUNNING CTRFORGE CAMPAIGN SYSTEM AUTOMATED TESTS ===\n');

// Test 1: formatTime24To12
console.log('Test 1: formatTime24To12 conversion');
assert.strictEqual(formatTime24To12('09:00'), '09:00 AM');
assert.strictEqual(formatTime24To12('12:00'), '12:00 PM');
assert.strictEqual(formatTime24To12('17:30'), '05:30 PM');
assert.strictEqual(formatTime24To12('00:15'), '12:15 AM');
console.log('  ✓ 24h to 12h formatting passed\n');

// Test 2: Sending Window check inside vs outside
console.log('Test 2: isDateInsideSendWindow verification');
const windowConfig = {
  sendWindowStart: '09:00',
  sendWindowEnd: '17:00',
  sendWindowTz: 'America/New_York',
  sendWindowDays: [1, 2, 3, 4, 5], // Mon-Fri
};

// 2026-08-17 is a Monday. 10:00 AM EDT (14:00 UTC)
const mondayInside = new Date('2026-08-17T14:00:00Z');
assert.strictEqual(isDateInsideSendWindow(mondayInside, windowConfig), true, 'Monday 10 AM EDT should be inside window');

// 2026-08-17 Monday 8:00 PM EDT (2026-08-18T00:00:00Z)
const mondayOutsideEvening = new Date('2026-08-18T00:00:00Z');
assert.strictEqual(isDateInsideSendWindow(mondayOutsideEvening, windowConfig), false, 'Monday 8 PM EDT should be outside window');

// 2026-08-16 is a Sunday (day 7)
const sundayInsideHours = new Date('2026-08-16T15:00:00Z'); // 11 AM EDT Sunday
assert.strictEqual(isDateInsideSendWindow(sundayInsideHours, windowConfig), false, 'Sunday should be outside allowed weekdays');
console.log('  ✓ Sending window detection passed\n');

// Test 3: calculateNextEligibleSendTime
console.log('Test 3: calculateNextEligibleSendTime roll-forward');
// If scheduled on Friday 8 PM EDT, next eligible should be Monday 9:00 AM EDT
const fridayNight = new Date('2026-08-21T20:00:00-04:00'); // 8 PM EDT
const nextEligibleFromFriday = calculateNextEligibleSendTime(fridayNight, windowConfig);
const nextParts = getTimePartsInTimezone(nextEligibleFromFriday, 'America/New_York');
assert.strictEqual(nextParts.weekdayShort, 'Mon', 'Should advance from Friday night to Monday');
assert.strictEqual(nextParts.timeString24, '09:00', 'Should advance to start of window (09:00)');
console.log(`  ✓ Advanced from Friday 8PM EDT to ${nextParts.weekdayShort} ${nextParts.timeString24} EDT\n`);

// Test 4: Follow-up Scheduling Calculation (Bug 6)
console.log('Test 4: calculateFollowupScheduledTime with independent send time');
const mainEmailSentAt = new Date('2026-08-17T09:30:00-04:00'); // Monday 9:30 AM EDT
const followup1Time = calculateFollowupScheduledTime({
  previousStepSentAt: mainEmailSentAt,
  delayDays: 3, // 3 days after Monday = Thursday
  sendTime: '10:30',
  sendTimeTz: 'America/New_York',
  campaignWindowConfig: windowConfig,
});
const fu1Parts = getTimePartsInTimezone(followup1Time, 'America/New_York');
assert.strictEqual(fu1Parts.weekdayShort, 'Thu', '3 days after Monday should be Thursday');
assert.strictEqual(fu1Parts.timeString24, '10:30', 'Send time should be 10:30');
console.log(`  ✓ Follow-up #1 scheduled for ${fu1Parts.weekdayShort} at ${fu1Parts.timeString24} (${fu1Parts.dateString})\n`);

// Test 5: Signature Portfolio URL (Bug 7)
console.log('Test 5: Signature Portfolio URL validation');
const { getPublicPortfolioUrl } = require('../src/lib/email/signature.ts');
const portfolioUrl = getPublicPortfolioUrl();
assert.strictEqual(portfolioUrl, 'https://gustostudio.vercel.app', 'Portfolio URL must be https://gustostudio.vercel.app');
console.log(`  ✓ getPublicPortfolioUrl() = ${portfolioUrl}\n`);

// Test 6: rewriteLinksForTracking Localhost protection (Bug 7)
console.log('Test 6: rewriteLinksForTracking Localhost protection');
const { rewriteLinksForTracking } = require('../src/lib/gmail/sender.ts');
const sampleHtml = '<p>Check out my <a href="https://gustostudio.vercel.app">Portfolio</a></p>';
// Under development (localhost base URL), external link should NOT be rewritten to localhost
const rewritten = rewriteLinksForTracking(sampleHtml, 'sample-cid-123');
assert.strictEqual(rewritten, sampleHtml, 'Should keep pristine https://gustostudio.vercel.app when base url is localhost');
console.log('  ✓ Pristine portfolio URL preserved in dev\n');

console.log('=== ALL AUTOMATED TESTS PASSED SUCCESSFULLY (6/6) ===');

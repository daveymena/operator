const SCHEDULE_HOUR = parseInt(process.env.PREOP_SCHEDULE_HOUR || '6');
const SCHEDULE_MINUTE = parseInt(process.env.PREOP_SCHEDULE_MINUTE || '30');

function checkTime() {
  const now = new Date();
  const tzOffset = -5 * 60;
  const local = new Date(now.getTime() + tzOffset * 60000);
  if (local.getHours() === SCHEDULE_HOUR && local.getMinutes() === SCHEDULE_MINUTE) {
    console.log(`[scheduler] Hora programada (${SCHEDULE_HOUR}:${SCHEDULE_MINUTE}) — ejecutando preoperacional...`);
  }
}

console.log(`[scheduler] Iniciado — programado para ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE} (Bogotá)`);
setInterval(checkTime, 60000);
checkTime();

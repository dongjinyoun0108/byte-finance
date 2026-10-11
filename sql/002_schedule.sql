-- Fires the Morning Coin at 7:25am Sydney time, Monday to Friday, to the minute.
-- Run once in the Supabase SQL editor AFTER deploying to Vercel.
-- Replace YOUR-APP.vercel.app and YOUR_CRON_SECRET first.
--
-- Why two schedules: cron runs in UTC and Sydney shifts between AEDT (UTC+11) and AEST (UTC+10).
-- 20:25 UTC = 7:25am AEDT, 21:25 UTC = 7:25am AEST. Both fire every day; the app only acts on the
-- one that lands at 7:10-7:50am Sydney time, so daylight saving needs no attention.
-- Sun-Thu in UTC = Mon-Fri in Sydney.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'morning-coin-aedt',
  '25 20 * * 0-4',
  $$ select net.http_get(
       url := 'https://YOUR-APP.vercel.app/api/run?job=morning',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
       timeout_milliseconds := 290000
     ) $$
);

select cron.schedule(
  'morning-coin-aest',
  '25 21 * * 0-4',
  $$ select net.http_get(
       url := 'https://YOUR-APP.vercel.app/api/run?job=morning',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
       timeout_milliseconds := 290000
     ) $$
);

-- To pause from here instead of Vercel:  select cron.unschedule('morning-coin-aedt'); select cron.unschedule('morning-coin-aest');
-- To see recent firings:                 select * from cron.job_run_details order by start_time desc limit 10;

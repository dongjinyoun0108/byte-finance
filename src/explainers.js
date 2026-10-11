// Weekend "Money explained" carousels: evergreen Aussie finance basics, one topic per weekend day.
// Written and fact-checked once (Oct 2026), so weekend posts never depend on the news or an AI writer.
// General information only. Every line passes the same advice/prediction word checks as the weekday stories.

export const WEEKEND_BASE_HASHTAGS = ['#AusFinance', '#FinancialLiteracy', '#FinanceEducation']; // 18k, 5.4m, 188k

export const TOPICS = [
  {
    id: 'cash-rate', title: 'What actually is\nthe cash rate?', pose: 'thinking', tags: ['#RBA', '#InterestRates'],
    steps: [
      { head: "The RBA's main lever", body: 'The cash rate is the interest rate banks charge each other on overnight loans. The Reserve Bank sets a target for it.' },
      { head: 'It flows to your loan', body: 'When the cash rate moves, banks usually adjust variable home loan and savings rates soon after.' },
      { head: 'Why it moves', figure: '2–3%', figureLabel: 'RBA inflation target', body: 'The RBA lifts the rate to cool inflation and cuts it to support spending and jobs.' },
      { head: 'When it is decided', figure: '8', figureLabel: 'board meetings a year', body: 'Decisions are announced at 2:30pm Sydney time on the final day of each meeting.' },
    ],
  },
  {
    id: 'compound-interest', title: 'Compound interest,\nexplained', pose: 'rocket', tags: ['#CompoundInterest', '#PersonalFinance'],
    steps: [
      { head: 'Interest on interest', body: 'You earn interest on your savings, then interest on that interest. Growth speeds up the longer it runs.' },
      { head: 'After 10 years', figure: '$16,289', figureLabel: 'from $10,000 at 5% a year', body: 'Compounded yearly at 5%, $10,000 grows to about $16,289 in a decade.' },
      { head: 'Time does the work', figure: '$26,533', figureLabel: 'same $10,000, after 20 years', body: 'Double the time and the result is far more than double the first decade’s gain.' },
      { head: 'It cuts both ways', body: 'Credit card debt compounds the same way, which is why unpaid balances can snowball.' },
    ],
  },
  {
    id: 'super', title: 'How super\nactually works', pose: 'cbd_strut', tags: ['#Superannuation', '#PersonalFinance'],
    steps: [
      { head: 'Your employer chips in', figure: '12%', figureLabel: 'employer super rate since July 2025', body: 'Employers pay a share of your ordinary earnings into a super fund in your name, on top of your pay.' },
      { head: 'Locked away for later', figure: '60', figureLabel: 'preservation age', body: 'You generally can’t access it until you reach preservation age and retire, with a few exceptions.' },
      { head: 'Your fund puts it to work', body: 'Funds spread it across assets through options like balanced or high growth. Fees and returns differ between funds.' },
      { head: 'Taxed lightly', figure: '15%', figureLabel: 'tax on employer contributions', body: 'That’s generally lower than most people’s income tax rate. Higher earners can pay more.' },
    ],
  },
  {
    id: 'etf', title: 'What is an ETF?', pose: 'trading_desk', tags: ['#ETFs', '#ShareMarket'],
    steps: [
      { head: 'A basket in one trade', body: 'An exchange-traded fund holds many shares or bonds, and trades on the ASX like a single share.' },
      { head: 'Tracking an index', body: 'Many ETFs follow an index like the ASX 200, so they rise and fall with that market.' },
      { head: 'The yearly fee', body: 'ETFs charge a management fee each year, shown as a percentage of what you hold.' },
      { head: 'Still a market product', body: 'Its value moves with the assets inside. Past returns are no promise of future ones.' },
    ],
  },
  {
    id: 'franking', title: 'Franking credits,\nexplained', pose: 'newspaper', tags: ['#Dividends', '#Tax'],
    steps: [
      { head: 'Tax already paid', body: 'Australian companies pay tax on profits. When they pay dividends, they can pass that tax on as franking credits.' },
      { head: 'No double tax', body: 'Shareholders count the credit against their own tax, so the same profit isn’t fully taxed twice.' },
      { head: 'Linked to company tax', figure: '30%', figureLabel: 'company tax (25% for small firms)', body: 'The credit reflects the tax rate the company actually paid.' },
      { head: 'Refunds are possible', body: 'If your tax rate is lower than the company’s, excess credits can be refunded at tax time.' },
    ],
  },
  {
    id: 'offset-redraw', title: 'Offset vs redraw:\nwhat’s the difference?', pose: 'coffee', tags: ['#HomeLoans', '#OffsetAccount'],
    steps: [
      { head: 'Offset account', body: 'A transaction account linked to your home loan. Its balance is subtracted from the loan before interest is worked out.' },
      { head: 'Redraw facility', body: 'Extra repayments sit inside the loan itself, and you can usually take them back out.' },
      { head: 'Same interest effect', body: 'Both cut the interest you pay, dollar for dollar, while the money sits there.' },
      { head: 'The catch', body: 'Redraw can come with limits or fees, and lenders can change the rules. Offset money stays in a separate account.' },
    ],
  },
  {
    id: 'inflation', title: 'What inflation\nreally means', pose: 'umbrella', tags: ['#Inflation', '#AustralianEconomy'],
    steps: [
      { head: 'Prices on the rise', body: 'Inflation is how fast prices rise across the economy. Australia measures it with the Consumer Price Index (CPI).' },
      { head: 'Each dollar stretches less', figure: '$97', figureLabel: 'what $100 gets you after 3% inflation', body: 'If prices rise 3% in a year, $100 gets you roughly what $97 did the year before.' },
      { head: 'The RBA’s target', figure: '2–3%', figureLabel: 'inflation target band', body: 'The Reserve Bank aims to keep inflation in this band on average over time.' },
      { head: 'Who measures it', body: 'The Australian Bureau of Statistics publishes the CPI, monthly and quarterly.' },
    ],
  },
  {
    id: 'asx200', title: 'What is the\nASX 200?', pose: 'quarter_zip', tags: ['#ASX200', '#ShareMarket'],
    steps: [
      { head: 'Top 200 companies', body: 'The S&P/ASX 200 tracks the 200 biggest companies listed on the ASX, weighted by size.' },
      { head: 'The market’s scoreboard', body: 'When the news says “the market rose today”, it usually means this index.' },
      { head: 'Heavy hitters', body: 'Banks and miners make up a big share of the index, so their moves count the most.' },
      { head: 'Points vs percent', body: 'Index points are just a number. The percentage change shows how big a move really was.' },
    ],
  },
  {
    id: 'cgt-discount', title: 'The 50% capital\ngains discount', pose: 'finger_gun', tags: ['#CapitalGainsTax', '#Tax'],
    steps: [
      { head: 'What a capital gain is', body: 'When an asset like shares or property is sold for more than you paid, the profit is a capital gain.' },
      { head: 'Part of your income', body: 'Net capital gains are added to your taxable income for that financial year.' },
      { head: 'The discount', figure: '50%', figureLabel: 'held for more than 12 months', body: 'Individuals can generally halve the taxable gain on assets held for over a year.' },
      { head: 'Your home is different', body: 'Your main residence is generally exempt from capital gains tax.' },
    ],
  },
  {
    id: 'bond-yields', title: 'What bond yields\ntell you', pose: 'trading_desk', tags: ['#Bonds', '#InterestRates'],
    steps: [
      { head: 'Lending to governments', body: 'A government bond is a loan to the government that pays interest. The yield is the return at today’s price.' },
      { head: 'A see-saw', body: 'When bond prices fall, yields rise, and the other way around.' },
      { head: 'A read on rates', body: 'Yields move with what markets expect from interest rates, so they’re watched closely.' },
      { head: 'Why borrowers care', body: 'Fixed home loan rates tend to follow longer-term borrowing costs like bond yields.' },
    ],
  },
  {
    id: 'aussie-dollar', title: 'What moves the\nAussie dollar?', pose: 'kangaroo', tags: ['#AUD', '#AustralianDollar'],
    steps: [
      { head: 'A price like any other', body: 'The Aussie dollar’s value is set by supply and demand on currency markets, around the clock.' },
      { head: 'Interest rate gaps', body: 'When Australian rates are high compared with the US, the dollar often gets support.' },
      { head: 'Commodities', body: 'Australia exports iron ore, coal and gas, so commodity prices often move the dollar.' },
      { head: 'Mood swings', body: 'The AUD is seen as a “risk” currency. It tends to slip when global markets get nervous.' },
    ],
  },
  {
    id: 'credit-score', title: 'How credit scores\nwork in Australia', pose: 'newspaper', tags: ['#CreditScore', '#PersonalFinance'],
    steps: [
      { head: 'A number for lenders', body: 'Credit bureaus like Equifax, Experian and illion turn your credit history into a score.' },
      { head: 'What counts', body: 'Repayments on loans and cards, how often you apply for credit, and any defaults all feed in.' },
      { head: 'Different scales', body: 'Each bureau uses its own scale, so your score can differ between them.' },
      { head: 'Free to check', figure: '3 months', figureLabel: 'free report from each bureau', body: 'You can get a free credit report from each bureau once every three months.' },
    ],
  },
];

/** Weekend days since Sat 17 Oct 2026 (Sat, Sun, Sat, ...): consecutive weekend posts get consecutive topics. */
export function weekendIndex(dateKey) {
  const d = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse('2026-10-17T00:00:00Z')) / 86400e3);
  const w = Math.floor(d / 7);
  return w * 2 + Math.min(((d % 7) + 7) % 7, 1);
}

export const pickTopic = (dateKey) => TOPICS[((weekendIndex(dateKey) % TOPICS.length) + TOPICS.length) % TOPICS.length];

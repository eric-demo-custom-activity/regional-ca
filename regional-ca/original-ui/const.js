const REWARD_TYPE_VALUES = {
    '--': null,
    GAME_DOLLAR: 1,
    TICKET: 2,
};

const REWARD_TYPE_LABELS = {
    [REWARD_TYPE_VALUES['--']]: '--',
    [REWARD_TYPE_VALUES['GAME_DOLLAR']]: 'GAME_DOLLAR',
    [REWARD_TYPE_VALUES['TICKET']]: 'TICKET',
};

const DOLLAR_TYPE_VALUES = {
    '--': null,
    C$: 1,
    T$: 2,
    'Cash(USD)': 3,
};

const DOLLAR_TYPE_LABELS = {
    [DOLLAR_TYPE_VALUES['--']]: '--',
    [DOLLAR_TYPE_VALUES['C$']]: 'C$',
    [DOLLAR_TYPE_VALUES['T$']]: 'T$',
    [DOLLAR_TYPE_VALUES['Cash(USD)']]: 'Cash(USD)',
};

const TICKETVALUE_VALUES = {
    '--': null,
    '$0 - $10': 1,
    '$10 - $20': 2,
    '$20 - $30': 3,
    '$30 - $40': 4,
    '$40 - $50': 5,
    '$50 - $60': 6,
    '$60 - $70': 7,
    '$70 - $80': 8,
    '$80 - $90': 9,
    '$90 - $100': 10,
};

const TICKETVALUE_LABELS = {
    [TICKETVALUE_VALUES['--']]: '--',
    [TICKETVALUE_VALUES['$0 - $10']]: '$0 - $10',
    [TICKETVALUE_VALUES['$10 - $20']]: '$10 - $20',
    [TICKETVALUE_VALUES['$20 - $30']]: '$20 - $30',
    [TICKETVALUE_VALUES['$30 - $40']]: '$30 - $40',
    [TICKETVALUE_VALUES['$40 - $50']]: '$40 - $50',
    [TICKETVALUE_VALUES['$50 - $60']]: '$50 - $60',
    [TICKETVALUE_VALUES['$60 - $70']]: '$60 - $70',
    [TICKETVALUE_VALUES['$70 - $80']]: '$70 - $80',
    [TICKETVALUE_VALUES['$80 - $90']]: '$80 - $90',
    [TICKETVALUE_VALUES['$90 - $100']]: '$90 - $100',
};

const TICKET_NAME_VALUES = {
    '--': null,
    'Promo Ticket: ¥25 SUPPER SAT to #9: Winter Championship': 1,
    'Promo Ticket: BHS: $20 Mystery MILLION$ Main Event [Stage 1]': 2,
    'Promo Ticket: ¥25 #16: Baby Dragon Mini Main': 3,
};

const TICKET_NAME_LABELS = {
    [TICKET_NAME_VALUES['--']]: '--',
    [TICKET_NAME_VALUES['Promo Ticket: ¥25 SUPPER SAT to #9: Winter Championship']]: 'Promo Ticket: ¥25 SUPPER SAT to #9: Winter Championship',
    [TICKET_NAME_VALUES['Promo Ticket: BHS: $20 Mystery MILLION$ Main Event [Stage 1]']]: 'Promo Ticket: BHS: $20 Mystery MILLION$ Main Event [Stage 1]',
    [TICKET_NAME_VALUES['Promo Ticket: ¥25 #16: Baby Dragon Mini Main']]: 'Promo Ticket: ¥25 #16: Baby Dragon Mini Main',
};

const EXPIRY_DATE_VALUES = {
    '--': null,
    'Absolute date': 1,
    'Relative date': 2,
};

const EXPIRY_DATE_LABELS = {
    [EXPIRY_DATE_VALUES['--']]: '--',
    [EXPIRY_DATE_VALUES['Absolute date']]: 'Absolute date',
    [EXPIRY_DATE_VALUES['Relative date']]: 'Relative date',
};

const WALLET_CLASS = {
    GCD: 'GCD',
    GTD: 'GTD',
    CASH: 'CASH',
}

const CURRENCY_ID = {
    USD: 'USD',
    GPD: 'GPD',
}
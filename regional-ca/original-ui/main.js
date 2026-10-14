///<reference path="../assets/js/jquery.js" />

const env = ["localhost","127.0.0.1"].includes(window.location.hostname) ? "development" : "production";

class App {
    constructor() {
        this.connection = new Postmonger.Session();
    }

    init() {
        this.activity = new Activity();
        this.connection.trigger('ready');
        this.connection.trigger('requestTokens');
        this.connection.trigger('requestEndpoints');
        this.connection.trigger('requestSenders');
        this.connection.trigger('requestInteraction');
        this.connection.trigger('requestSchema');
        this.connection.on('clickedNext', this.handleUpdateJourney.bind(this));
        this.connection.on('requestedTokens', this.handleGetTokens.bind(this));
        this.connection.on('requestedEndpoints', this.handleGetEndpoints.bind(this));
        this.connection.on('requestedSenders', this.handleGetSenders.bind(this));
        this.connection.on('requestedInteraction', this.handleGetInteraction.bind(this));
        this.connection.on('requestedSchema', this.handleGetSchema.bind(this));
        if (env === "production") {
            this.connection.on('initActivity', (data) => this.activity.init(data));
        } else {
            this.activity.init()
        }
    }

    handleGetTokens(tokens) {
        console.log('Value of tokens:', tokens);
        console.log('Value of UID:', tokens.UID);
    }

    handleGetEndpoints(endpoints) {
        console.log('Value of endpoints:', endpoints);
    }

    handleGetSenders(senders) {
        console.log('Value of senders:', senders);
    }

    handleGetInteraction(interaction) {
        console.log(interaction);
        if (interaction.triggers[0]) {
            this.activity.storedEventDefinitionKey =
                interaction.triggers[0].metaData.eventDefinitionKey;
        } else {
            alert('Please choose ENTRY EVENT and SAVE Journey before Continue');
        }
    }

    handleGetSchema(schema) {
        console.log(schema);
    }

    handleUpdateJourney() {
        if (!this.activity.isValid) {
            alert(`입력값을 확인 해 주세요, ${JSON.stringify(this.activity.rewards.filter(reward => !reward.isValid).map(reward => ({
                id: reward.id,
                ...reward.errorMessages,
            })), null, 4)}`);
            this.connection.trigger('prevStep');
            return;
        }
        const payload = this.activity.toEvenDataFormat();
        alert(`success (확인용): ${JSON.stringify(payload.arguments.execute, null, 4)}`);
        this.connection.trigger('updateActivity', payload);
    }
}

class Activity {
    storedEventDefinitionKey = '';

    constructor() {}

    init(data) {
        console.log(env)
        console.log('data', data);

        if (data) {
            this.payload = data;
        } else {
            this.payload = {};
        }

        this.name = this.payload?.arguments?.execute?.inArguments?.activityName || '';
        this.rewards = [];
        const parsedRewards = this.parseRewards(this.payload?.arguments?.execute?.inArguments?.rewards || []);
        if (parsedRewards.length === 0) {
            parsedRewards.push(new Reward());
        }
        parsedRewards.forEach(this.addReward.bind(this));
        $('#activity-name').val(this.name);
        $('#activity-name').on('change', this.changeActivityName.bind(this));
        $('#add-reward-button').on('click', () => {
            if (this.rewards.length === 10) {
                alert("You can only add up to 9 rewards.");
                return
            }
            this.addReward.call(this, new Reward())
        });
    }

    get isValid() {
        return this.rewards.every((reward) => reward.isValid);
    }

    set storedEventDefinitionKey(key) {
        this.storedEventDefinitionKey = key;
    }

    changeActivityName(e) {
        const newValue = e.target.value;
        this.name = newValue;
    }

    parseRewards(rewards) {
        return rewards.map((reward) => {
            if (reward.rewardType === REWARD_TYPE_VALUES['GAME_DOLLAR']) {
                return new GameDollarReward({
                    dollarType: reward.dollarType,
                    dollarAmount: reward.amount,
                    currencyId: reward.currencyId,
                    expenseBrand: reward.brand,
                    expenseNetwork: reward.network,
                    agentDeducted: reward.agentDeducted,
                    walletClass: reward.walletClass,
                });
            } else if (reward.rewardType === REWARD_TYPE_VALUES['TICKET']) {
                return new TicketReward();
            }
        });
    }

    addReward(newReward) {
        this.rewards.push(newReward);
        $('#form').append(this.getRewardHTML(newReward, this.rewards.length - 1));
        newReward.invokeEventHandlers();
    }

    removeReward(element) {
        const elementId = element.dataset.id;
        this.rewards = this.rewards.filter(reward => reward.id !== elementId);
        $('#form').children(`#reward-container-${elementId}`).remove();
    }

    getRewardHTML(reward, index) {
        return `
            <div id="reward-container-${reward.id}" class="container-border reward-section">
                <div class="row">
                    ${reward.html}
                </div>
                ${
                    index > 0
                        ? `<button type="button" class="btn btn-danger close-button" data-id="${reward.id}" onclick="app.activity.removeReward(this)">X</button>`
                        : ''
                }
            </div>
        `;
    }

    getRewardsHTML() {
        return this.rewards.map(this.getRewardHTML);
    }

    handleTransformReward(reward, type) {
        const oldId = reward.id;
        const newReward = reward.transform(type);
        const index = this.rewards.indexOf(reward);
        this.rewards[index] = newReward;
        reward.revokeEventHandlers();
        reward = null;
        $(`#reward-container-${oldId}`).replaceWith(this.getRewardHTML(newReward, index)).attr("id", `#reward-container-${newReward.id}`);
        newReward.invokeEventHandlers();
    }

    toEvenDataFormat() {
        this.payload.arguments = {
            ...this.payload.arguments,
            execute: {
                ...this.payload.arguments.execute,
                inArguments: [{
                    activityName: this.name,
                    requestId: `{{Event.${this.storedEventDefinitionKey}.ggpassId}}`,
                    requestedAt: new Date().toISOString(),
                    rewards: this.rewards.map((reward) => reward.toEvenDataFormat()),
                }]
            },
        };
        this.payload.metaData.isConfigured = true;
        this.payload.name = this.name;
        return this.payload;
    }
}

class Reward {
    errorMessages = {
        type: 'Invalid reward type',
    };
    type = REWARD_TYPE_VALUES['--'];

    constructor(initValue = {}) {
        Object.entries(initValue).forEach(([key, value]) => {
            this[key] = value;
            this.errorMessages[key] =
                value === null || value === undefined ? 'This field is empty' : '';
        });
        this.id = uuidv4();
    }

    get isValid() {
        return Object.values(this.errorMessages).every((value) => value === '');
    }

    get html() {
        return `
            <div class="reward">
                <div class="col-xs-12 col-sm-6 col-md-2">
                    <label for="select-reward-type-${this.id}">Reward Type</label>
                    <select id="select-reward-type-${this.id}" class="form-control">
                        ${getOptionsHTML(REWARD_TYPE_VALUES, REWARD_TYPE_LABELS, this.type)}
                    </select>
                </div>
            </div>
        `;
    }

    invokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).on('change', (e) => {
            app.activity.handleTransformReward(this, Number(e.target.value));
        });
    }

    revokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).off('change');
    }

    changeValue(key, value) {
        console.log({ key, value });
        this[key] = value;
    }

    transform(type) {
        if (type === REWARD_TYPE_VALUES['GAME_DOLLAR']) {
            return new GameDollarReward();
        } else if (type === REWARD_TYPE_VALUES['TICKET']) {
            return new TicketReward();
        }
    }

    toEvenDataFormat() {
        return {};
    }
}

class GameDollarReward extends Reward {
    type = REWARD_TYPE_VALUES['GAME_DOLLAR'];

    constructor(
        initValue = {
            dollarType: null,
            dollarAmount: 0,
            expenseBrand: 100,
            agentDeducted: true,
            currencyId: null,
            walletClass: null,
        }
    ) {
        super(initValue);
        delete this.errorMessages['type'];
        delete this.errorMessages['currencyId'];
        delete this.errorMessages['walletClass'];
    }

    get html() {
        return `
            <div class="reward">
                <div class="col-xs-12 col-sm-6 col-md-2">
                    <label for="select-reward-type-${this.id}">Reward Type</label>
                    <select id="select-reward-type-${this.id}" class="form-control">
                        ${getOptionsHTML(REWARD_TYPE_VALUES, REWARD_TYPE_LABELS, this.type)}
                    </select>
                </div>

                <div class="col-sm-2">
                    <label for="select-dollar-type-${this.id}">Dollar Type</label>
                    <select id="select-dollar-type-${this.id}" class="form-control">
                        ${getOptionsHTML(DOLLAR_TYPE_VALUES, DOLLAR_TYPE_LABELS, this.dollarType)}
                    </select>
                </div>

                <div class="col-sm-2">
                    <label for="input-dollar-amount-${this.id}">Amount</label>
                    <input
                        id="input-dollar-amount-${this.id}"
                        type="number"
                        class="form-control"
                        placeholder="Enter the value"
                        min="0"
                        step="0.01"
                        value=${this.dollarAmount.toFixed(2)}
                    />
                    <div
                        style="
                            color=gray;
                            padding-top: 5px;
                            font-size: 12px;
                            margin-top: 4px;
                            width: 150px;
                        "
                    >
                        You can set up to two decimal places.
                    </div>
                    <div
                        id="input-dollar-amount-${this.id}-error"
                        style="color: red; width: 150px; font-size: 12px"
                    ></div>
                </div>

                <div class="col-sm-3" style="width: 18.666667%">
                    <label style="font-weight: normal; margin-left: 29%">Expense Option</label>
                    <div class="form-group">
                        <div style="display: flex; align-items: center">
                            <label style="padding-right: 24px" for="input-expense-brand-${this.id}">Brand</label>
                            <input
                            id="input-expense-brand-${this.id}"
                                type="text"
                                class="form-control"
                                style="margin: -4px; text-align: center; padding: 0"
                                placeholder="Enter the value"
                                value="100%"
                                readonly = true
                            />
                        </div>

                        <div
                            id="input-expense-${this.id}-error"
                            style="
                                color: red;
                                width: 300px;
                                font-size: 12px;
                                padding-top: 5px;
                            "
                        ></div>
                    </div>
                </div>

                <div class="col-sm-2">
                    <input
                        id="input-agent-deducted-${this.id}"
                        type="checkbox"
                        ${this.agentDeducted ? "checked" : ""}
                    />
                    <label for="input-agent-deducted-${this.id}">Agent Deducted</label>
                </div>
            </div>
        `;
    }

    invokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).on('change', (e) => {
            app.activity.handleTransformReward(this, Number(e.target.value));
        });
        $(`#select-dollar-type-${this.id}`).on('change', this.handleDollarTypeChange.bind(this));
        $(`#input-dollar-amount-${this.id}`).on('change', this.handleDollarAmountChange.bind(this));
        $(`#input-agent-deducted-${this.id}`).on('change', this.handleAgentDeductedChange.bind(this));
    }

    handleDollarTypeChange(e) {
        const newValue = Number(e.target.value);
        let errorMsg = '';
        if (!newValue) {
            errorMsg = 'This field is empty';
        }
        this.errorMessages['dollarType'] = errorMsg;
        this.changeValue('dollarType', newValue);
        if (newValue === DOLLAR_TYPE_VALUES['C$']) {
            this.changeValue('walletClass', WALLET_CLASS['GCD']);
            this.changeValue('currencyId', CURRENCY_ID['USD']);
        } else if (newValue === DOLLAR_TYPE_VALUES['T$']) {
            this.changeValue('walletClass', WALLET_CLASS['GTD']);
            this.changeValue('currencyId', CURRENCY_ID['USD']);
        } else if (newValue === DOLLAR_TYPE_VALUES['Cash(USD)']) {
            this.changeValue('walletClass', WALLET_CLASS['CASH']);
            this.changeValue('currencyId', CURRENCY_ID['USD']);
        }
    }

    handleDollarAmountChange(e) {
        const newValue = parseFloat(e.target.value);
        let errorMsg = '';
        const decimalCount = (newValue.toString().split('.')[1] || []).length;

        if (newValue <= 0) {
            errorMsg = 'Value is not proper.';
        } else if (decimalCount > 2) {
            errorMsg = 'Only up to two decimal places are allowed.';
        } else if (newValue > 100) {
            errorMsg = 'Max Amount is 100.';
        }
        this.errorMessages['dollarAmount'] = errorMsg;
        $(`#input-dollar-amount-${this.id}-error`).empty().append(errorMsg);
        this.changeValue('dollarAmount', newValue);
    }

    handleAgentDeductedChange(e) {
        this.changeValue('agentDeducted', e.target.checked);
    }

    revokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).off('change');
        $(`#select-dollar-type-${this.id}`).off('change');
        $(`#input-dollar-amount-${this.id}`).off('change');
        $(`#input-agent-deducted-${this.id}`).off('change');
    }

    toEvenDataFormat() {
        return {
            currencyId: this.currencyId,
            amount: this.dollarAmount,
            brand: this.expenseBrand,
            network: this.expenseNetwork,
            agentDeducted: this.agentDeducted,
            walletClass: this.walletClass,
        };
    }
}

class TicketReward extends Reward {
    type = REWARD_TYPE_VALUES['TICKET'];
    flatpickrInstance;

    constructor(
        initValue = {
            ticketValue: null,
            ticketName: null,
            quantity: 1,
            expiryDateType: null,
            absExpiryDateValue: null,
            relExpiryDateValue: null,
            expenseBrand: 100,
            agentDeducted: true,
        }
    ) {
        super(initValue);
        delete this.errorMessages['type'];
    }

    get html() {
        return `
            <div class="reward">
                <div class="col-xs-12 col-sm-6 col-md-2">
                    <label for="select-reward-type-${this.id}">Reward Type</label>
                    <select id="select-reward-type-${this.id}" class="form-control">
                        ${getOptionsHTML(REWARD_TYPE_VALUES, REWARD_TYPE_LABELS, this.type)}
                    </select>
                </div>

                <div class="col-sm-2">
                    <label for="select-ticket-value-${this.id}">Ticket Value</label>
                    <select id="select-ticket-value-${this.id}" class="form-control">
                        ${getOptionsHTML(TICKETVALUE_VALUES, TICKETVALUE_LABELS, this.ticketValue)}
                    </select>
                </div>

                <div class="col-sm-3">
                    <label for="select-ticket-name-${this.id}">Ticket Name</label>
                    <select id="select-ticket-name-${this.id}" class="form-control">
                        ${getOptionsHTML(TICKET_NAME_VALUES, TICKET_NAME_LABELS, this.ticketName)}
                    </select>
                </div>

                <div class="col-sm-1">
                    <label for="input-quantity-${this.id}">Quantity</label>
                    <input
                        id="input-quantity-${this.id}"
                        type="number"
                        class="form-control"
                        value=${this.quantity}
                    />
                    <div
                        id="input-quantity-${this.id}-error"
                        style="color: blue; font-size: 12px; padding-top: 8px; min-width: 200px"
                    >Unit value = $20/ Total value = $20</div>
                </div>

                <div class="col-sm-2">
                    <label for="select-expiry-date-type-${this.id}">Expiry Date</label>
                    <select id="select-expiry-date-type-${this.id}" class="form-control">
                        ${getOptionsHTML(EXPIRY_DATE_VALUES, EXPIRY_DATE_LABELS, this.expiryDateType)}
                    </select>
                </div>

                <div id="container-abs-expiry-date-value-${this.id}" class="col-sm-2 hidden">
                    <label for="select-expiry-date-type-${this.id}"></label>
                    <div style="display: flex; align-items: center">
                        <input
                            id="input-abs-expiry-date-value-${this.id}"
                            type="text"
                            style="width: 159px; margin-top: 5px"
                            class="form-control flatpickr-input"
                            placeholder="year-month-date"
                        />
                        <span style="margin-left: 5px">00:00</span>&nbsp;<span>UTC</span>
                        <div
                            id="input-abs-expiry-date-value-${this.id}-warning"
                            class="relativeDateInputWarning"
                            style="
                                position: absolute;
                                bottom: -8px;
                                left: 0px;
                                width: 300px;
                                font-size: 12px;
                                margin-left: 15px;
                            "
                        ></div>
                    </div>
                </div>

                <div id="container-rel-expiry-date-value-${this.id}" class="col-sm-2 hidden">
                    <label for="select-expiry-date-type-${this.id}"></label>
                    <div style="display: flex; align-items: center; position: relative">
                        <input
                            id="input-rel-expiry-date-value-${this.id}"
                            type="number"
                            class="form-control"
                            placeholder="Number of"
                            style="width: 159px; margin-top: 5px"
                            ${this.relExpiryDateValue ? `value=${this.relExpiryDateValue}` : ''}
                            min="0"
                        />
                        <span
                            style="
                                position: absolute;
                                right: 5px;
                                top: 50%;
                                transform: translateY(-50%);
                                margin-left: 5px;
                                display: inline-block;
                                margin-top: 2.5px;
                            "
                            >days</span
                        >
                        <div
                            id="input-rel-expiry-date-value-${this.id}-error"
                            class="relativeDateInputError"
                            style="
                                position: absolute;
                                bottom: -24px;
                                left: 0px;
                                color: red;
                                width: 300px;
                                font-size: 12px;
                            "
                        ></div>
                        <div
                            id="input-rel-expiry-date-value-${this.id}-warning"
                            class="relativeDateInputWarning"
                            style="
                                position: absolute;
                                bottom: -24px;
                                left: 0px;
                                color: blue;
                                width: 300px;
                                font-size: 12px;
                            "
                        ></div>
                    </div>
                </div>

                <div class="col-sm-3" style="display: flex; margin-right: 500px; width: 1000px; align-items:center">
                    <label style="margin-bottom: 0px">Expense Option</label>
                    <div style="display: flex; align-items: center; margin-left: 10px">
                        <div style="display: flex; align-items: center; margin-left: 10px">
                            <label
                                style="font-weight: normal; margin-left: 4px; margin-bottom: 0px; margin-right: 10px"
                                for="input-expense-brand-${this.id}"
                            >Brand</label>
                            <input
                                type="text"
                                class="form-control"
                                id="input-expense-brand-${this.id}"
                                style="margin: -4px; text-align: center; padding: 0; width: 95px"
                                placeholder="Enter the value"
                                value="100%"
                                readonly = true
                            />
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; margin-left: 10px">
                        <div style="display: flex; align-items: center">
                            <input
                                type="checkbox"
                                style="margin-top: 0px"
                                id="input-agent-deducted-${this.id}"
                                ${this.agentDeducted ? "checked" : ""}
                            />
                            <label
                                style="font-weight: normal; margin-bottom: 0px; margin-left: 4px"
                                for="input-agent-deducted-${this.id}"
                            >Agent Deducted</label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    invokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).on('change', (e) => {
            app.activity.handleTransformReward(this, Number(e.target.value));
        });
        $(`#select-ticket-value-${this.id}`).on('change', this.handleTicketValueChange.bind(this));
        $(`#select-ticket-name-${this.id}`).on('change', this.handleTicketNameChange.bind(this));
        $(`#input-quantity-${this.id}`).on('change', this.handleQuantityChange.bind(this));
        $(`#select-expiry-date-type-${this.id}`).on('change', this.handlExpiryDateTypeChange.bind(this));
        $(`#input-abs-expiry-date-value-${this.id}`).on('change', this.handleAbsExpiryDateChange.bind(this));
        $(`#input-rel-expiry-date-value-${this.id}`).on('change', this.handleRelExpiryDateChange.bind(this));
        $(`#input-agent-deducted-${this.id}`).on('change', this.handleAgentDeductedChange.bind(this));
    }

    handleTicketValueChange(e) {
        const newValue = Number(e.target.value);
        let errorMsg = '';
        if (!newValue) {
            errorMsg = 'This field is empty';
        }
        this.errorMessages['ticketValue'] = errorMsg;
        this.changeValue('ticketValue', newValue);
    }

    handleTicketNameChange(e) {
        const newValue = Number(e.target.value);
        let errorMsg = '';
        if (!newValue) {
            errorMsg = 'This field is empty';
        }
        this.errorMessages['ticketName'] = errorMsg;
        this.changeValue('ticketName', newValue);
    }

    handleQuantityChange(e) {
        const newInput = e.target.value.trim();
        const newValue = parseInt(newInput);
        let errorMsg = '';
        let errorMsgColor = 'blue';

        if (!/^\d+$/.test(newInput)) {
            errorMsg = 'Value is not proper.';
            errorMsgColor = 'red';
        } else if (newValue <= 0) {
            errorMsg = 'Value is not proper.';
            errorMsgColor = 'red';
        } else if (newValue > 5) {
            errorMsg = 'Total value is over $100';
            errorMsgColor = 'red';
        } else if (newValue) {
            errorMsg = 'Unit value = $20' + '/ Total value = $' + 20 * newValue;
            errorMsgColor = 'blue';
        }

        this.errorMessages['quantity'] = errorMsgColor === 'red' ? errorMsg : '';
        $(`#input-quantity-${this.id}-error`).empty().append(errorMsg).css('color', errorMsgColor);
        this.changeValue('quantity', newValue);
    }

    handlExpiryDateTypeChange(e) {
        const newValue = Number(e.target.value);
        let errorMsg = '';
        if (!newValue) {
            errorMsg = 'This field is empty';
        }
        if (newValue === EXPIRY_DATE_VALUES['Absolute date']) {
            this.flatpickrInstance = flatpickr(`#input-abs-expiry-date-value-${this.id}`, {
                enableTime: false,
                dateFormat: 'Y-m-d',
                allowInput: true,
            });
            $(`#container-abs-expiry-date-value-${this.id}`).removeClass('hidden');
            $(`#container-rel-expiry-date-value-${this.id}`).addClass('hidden');
            $(`#input-rel-expiry-date-value-${this.id}`).val('');
        } else if (newValue === EXPIRY_DATE_VALUES['Relative date']) {
            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }
            $(`#container-abs-expiry-date-value-${this.id}`).addClass('hidden');
            $(`#input-abs-expiry-date-value-${this.id}`).val('');
            $(`#container-rel-expiry-date-value-${this.id}`).removeClass('hidden');
        }
        this.errorMessages['dollarType'] = errorMsg;
        this.changeValue('expiryDateType', newValue);
    }

    handleAbsExpiryDateChange(e) {
        const newValue = e.target.value;
        let errorMsg = '';
        let warningMsgBottom = '-24px';
        if (!newValue) {
            errorMsg = 'This field is empty';
        }
        const helperText = `The ticket is valid until ${newValue} 00:00 UTC`;
        $(`#input-abs-expiry-date-value-${this.id}-warning`).empty().append(helperText).css('bottom', warningMsgBottom);
        this.errorMessages['absExpiryDateValue'] = errorMsg;
        this.changeValue('absExpiryDateValue', newValue);
    }

    handleRelExpiryDateChange(e) {
        const newInput = e.target.value.trim();
        const newValue = parseInt(newInput);
        const validNumber = /^[0-9]*\.?[0-9]*$/;
        const validNumberE = /^(\d+|\d+\.\d+|\.\d+)([eE][-+]?\d+)?$/;
        let errorMsg = '';
        let errorMsgColor = 'inherit';
        let warningMsg = '';
        let warningMsgBottom = '-24px';

        if (!validNumber.test(newInput) || !validNumberE.test(newInput)) {
            errorMsg = 'Value is not proper.';
            errorMsgColor = 'red';
            warningMsg = '';
        } else if (newInput < 0) {
            errorMsg = 'Value is not proper.';
            errorMsgColor = 'red';
            warningMsg = '';
        } else if (newValue > 30 || newValue === 0) {
            const today = new Date();
            const numberOfDays = newValue;
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + numberOfDays);
            const formattedDateEnd2 = endDate.toISOString().split('T')[0];
            errorMsg = 'The ticket is valid until ' + formattedDateEnd2 + ' 00:00 UTC';
            errorMsgColor = 'gray';
            warningMsg = 'Validity period is greater than 30 days or is 0.';
            warningMsgBottom = '-45px';
        } else {
            const today = new Date();
            const numberOfDays = newValue;
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + numberOfDays);
            const formattedDateEnd = endDate.toISOString().split('T')[0];
            errorMsg = 'The ticket is valid until ' + formattedDateEnd + ' 00:00 UTC';
            errorMsgColor = 'gray';
            warningMsg = '';
            warningMsgBottom = '-45px';
        }

        this.errorMessages['relExpiryDateValue'] = errorMsgColor === 'red' ? errorMsg : '';
        $(`#input-rel-expiry-date-value-${this.id}-error`).empty().append(errorMsg).css('color', errorMsgColor);
        $(`#input-rel-expiry-date-value-${this.id}-warning`).empty().append(warningMsg).css('bottom', warningMsgBottom);
        this.changeValue('relExpiryDateValue', newValue);
    }

    handleAgentDeductedChange(e) {
        this.changeValue('agentDeducted', e.target.checked);
    }

    revokeEventHandlers() {
        $(`#select-reward-type-${this.id}`).off('change');
        $(`#select-ticket-value-${this.id}`).off('change');
        $(`#select-ticket-name-${this.id}`).off('change');
        $(`#input-quantity-${this.id}`).off('change');
        $(`#select-expiry-date-type-${this.id}`).off('change');
        $(`#input-abs-expiry-date-value-${this.id}`).off('change');
        $(`#input-rel-expiry-date-value-${this.id}`).off('change');
        $(`#input-agent-deducted-${this.id}`).off('change');
    }

    toEvenDataFormat() {
        return {
            ticketValue: this.ticketValue,
            ticketName: this.ticketName,
            quantity: this.quantity,
            expiryDateType: this.expiryDateType,
            absExpiryDateValue: this.absExpiryDateValue,
            relExpiryDateValue: this.relExpiryDateValue,
            brand: this.expenseBrand,
            agentDeducted: this.agentDeducted,
            network: this.expenseNetwork,
        };
    }
}

const app = new App();

$(() => {
    app.init();
    console.log(app);
});

var constants = require('../constants');

// Kraken calls, pending review

async function processOrder(decision) {
    var pair = api.pair;
    var volume = decision.quantity;
    if (decision.userref != undefined) {
        var userref = decision.userref;
    } else {
        var userref = undefined;
    }
    if (decision.price != 'market') {
        var ordertype = 'limit';
        var price = decision.price;
    } else {
        var ordertype = 'market';
        var price = undefined;
    }
    if (decision.type == cosntants.placeBuy) {
        var type = 'buy';
        try {
            var order = await kraken.api('AddOrder', {pair, type, price, volume, ordertype, userref});
            return order;
        }
        catch (e) {
            api.errorHistory.push(e);
        }
    } else if (decision.type == constants.placeSell) {
        var type = 'sell';
        try {
            var order = await kraken.api('AddOrder', {pair, type, price, volume, ordertype, userref});
            return order;
        }
        catch (e) {
            api.errorHistory.push(e);
        }
    } else if (decision.type == constants.updateBuy) {
        var type = 'buy';
        var txid = decision.txid;
        try {
            var cancel = await kraken.api('CancelOrder', {txid});
            if (cancel.result.count == 1) {
                var order = await kraken.api('AddOrder', {pair, type, price, volume, ordertype, userref});
                return order;
            }
        }
        catch (e) {
            api.errorHistory.push(e);
        }
    } else if (decision.type == constants.updateSell) {
        var type = 'sell';
        var txid = decision.txid;
        try {
            var cancel = await kraken.api('CancelOrder', {txid});
            if (cancel.result.count == 1) {
                var order = await kraken.api('AddOrder', {pair, type, price, volume, ordertype, userref});
                return order;
            }
        }
        catch (e) {
            api.errorHistory.push(e);
        }
    }
}

exports.getValues = async function (keys) {
    var count = 1;
    var pair = api.pair;
    var txid = keys.join (', ');
    try {
        var response = await kraken.api('Depth', {pair, count});
        var tradeBalances = await kraken.api('Balance', {});
        var orders = await kraken.api('QueryOrders', {txid});
        var balance = Number(tradeBalances[api.second]);
        var bid = Number(response['result'][api.fullPair]['bids'][0][0]);
        var ask = Number(response['result'][api.fullPair]['asks'][0][0]);
        var value = (bid + ask) / 2;
        var values = {bid, ask, value, balance, orders};
        return values;
    }
    catch (e) {
        api.errorHistory.push(e);
        api.getValues(keys);
    }
}

var execute = async function (decision) {
    var keys;
    if (decision.type == 'standby') {
        keys = decision.keys;
    }
    else {
        var order = processOrder(decision);
        if (order != undefined) {
            decision.keys.push(order.result.txid);
            keys = decision.keys;
        }
    }
    return keys;
}

// this is overloading the execute function, if you see processOrder has lots of
// if ... else.. the idea es to create functions for each type so then we can call them directly
var executeFunctions = {};
executeFunctions[constants.placeBuy] = execute;
executeFunctions[constants.placeSell] = execute;
executeFunctions[constants.cancelBuy] = execute;
executeFunctions[constants.cancelSell] = execute;
executeFunctions[constants.updateOrder] = execute;
exports.executeFunctions = executeFunctions;

exports.initialize = function(pair) {
    api.pair = pair;
    api.first = pair.substring(0, 3);
    api.second = pair.substring(3, 6);
    api.fullPair = 'X' + api.first + 'Z' + api.second;
    api.errorHistory = [];
}

exports.continue = function() {
    return true;
}
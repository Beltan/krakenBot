const fs = require('fs');
var constants = require('../constants');

var api = {};

function roundTo2(number) {
    multiplier = 100;
    number = Math.round(number * multiplier) / multiplier;
    return number;
}

function getRandomInt() {
    var number = Math.random();
    if (number < 0.5) {
        return 0;
    } else {
        return 1;
    }
  }

var csvToArray = function() {
    var stuff = fs.readFileSync('./historics/' + api.pair + '.csv', 'utf8');
    api.historic = stuff.split(',');
}

// Order functions
var placeOrder = function({type, order, ordertype, quantity, price, userref}) {
    
    api.txid++;
    
    var descr = {'type' : order, ordertype, price};

    var result = {txid : api.txid, price, vol : quantity, userref, descr};

    //init values order
    result.vol_exec = 0;
    result.status = constants.open;
    result.createdTime = new Date();
    
    api.openOrders[api.txid] = result;

    return result;
}

var processOrder = function(txid, updatedValue) {
    var order = api.openOrders[txid];
    var quantity = 0;
    var price = undefined;
    var bid = updatedValue * 0.9995;
    var ask = updatedValue * 1.0005;

    // update the balance
    if(order.descr.type == 'buy' && bid < order.descr.price && order.status == constants.open) {
        ({price, quantity} = buy(order, bid));
    }
    else if(order.descr.type == 'sell' && order.descr.ordertype != 'market' && bid > order.descr.price && order.status == constants.open) {
        ({price, quantity} = sell(order, order.descr.price));
    }
    else if(order.descr.type == 'sell' && order.descr.ordertype == 'market' && order.status == constants.open) {
        ({price, quantity} = sell(order, bid));
    }
    // update the order       
    api.openOrders[txid].vol_exec += quantity;
    //this should be the mean
    if (price != undefined) {
        api.openOrders[txid].price = price;
    }
    if(Math.abs(api.openOrders[txid].vol_exec - api.openOrders[txid].vol) <= 0.1) {
        api.openOrders[txid].status = constants.closed;
    }

    return updatedValue;
}

var update = function(newValue) {

    var updatedValue = newValue;

    // process orders
    for(var nextTxid in api.openOrders) {
        updatedValue = processOrder(nextTxid, updatedValue);
    }
    
    // updated value is useless right now, but can be usefull in the future, so I let it
    return updatedValue;
}

var buy = function(order, bid) {
    
    /*
    if (getRandomInt() == 0) {
        var quantity = order.vol - order.vol_exec;
    } else {
        if (order.vol_exec < 0.6 * order.vol) {
            var quantity = order.vol * 0.4;
        } else {
            var quantity = order.vol - order.vol_exec;
        }
    }
    */
    var quantity = order.vol - order.vol_exec;
    var price = (order.vol_exec * order.price + bid * quantity) / (order.vol_exec + quantity);
    var commission = quantity * bid * config.commission;

    // update balances
    api.balance[api.second] = roundTo2(api.balance[api.second] - commission - quantity * bid);
    api.balance[api.first] = roundTo2(api.balance[api.first] + quantity);

    return {price, quantity};
}

var sell = function(order, value) {
/*
    if (order.descr.ordertype != 'market') {
        if (getRandomInt() == 0) {
            var quantity = order.vol - order.vol_exec;
        } else {
            if (order.vol_exec < 0.6 * order.vol) {
                var quantity = order.vol * 0.4;
            } else {
                var quantity = order.vol - order.vol_exec;
            }
        }
    } else {
        var quantity = order.vol - order.vol_exec;
    }
*/
    if (order.price == undefined) {
        var truePrice = value;
    } else {
        var truePrice = order.price;
    }
    var quantity = order.vol - order.vol_exec;
    var price = (order.vol_exec * truePrice + value * quantity) / (order.vol_exec + quantity);
    var commission = quantity * value * config.commission;

    // update balances
    api.balance[api.second] = roundTo2(api.balance[api.second] + quantity * value - commission);
    api.balance[api.first] = roundTo2(api.balance[api.first] - quantity);

    return {price, quantity};
}

// Decision functions: For each decision we declare a function
var placeDecisionOrder = function(decision) {
    return placeOrder(decision);
}

var cancelOrder = function(decision) {
    for (var key in api.openOrders) {
        if (api.openOrders[key].status == constants.open && api.openOrders[key]['userref'] == decision.txid) {
            api.openOrders[key].status = constants.canceled;
            return 1;
        }
    }
}

var updateOrder = function(decision) {
    cancelOrder(decision);
    return placeOrder(decision);
}

// and then we add the functions to the object
var executeFunctions = {};
executeFunctions[constants.placeBuy] = placeDecisionOrder;
executeFunctions[constants.placeSell] = placeDecisionOrder;
executeFunctions[constants.cancel] = cancelOrder;
executeFunctions[constants.updateBuy] = updateOrder;
executeFunctions[constants.updateSell] = updateOrder;
exports.executeFunctions = executeFunctions;

exports.getValues = function() {
    var value;
    var balance = [];

    if (api.index < api.historic.length){
        value = api.historic[api.index];
        api.index++;
    } 
    else {
        console.log("No more values for simulation");
        return;
    }

    var oldValue = value;
    value = update(value);

    var bid = value * 0.9995;
    var ask = value * 1.0005;
    balance[0] = api.balance[api.second];
    balance[1] = api.balance[api.first];
    var values = {bid, ask, value, balance, openOrders : api.openOrders};
    return values;
}

exports.initialize = function() {
    var pair = config.pair;
    api.pair = pair;
    api.first = pair.substring(0, 3);
    api.second = pair.substring(3, 6);
    api.balance = {[api.second] : 200, [api.first] : 0};
    
    api.index = 0;
    api.txid = 0;
    api.openOrders = {};

    csvToArray();
}

exports.continue = function() {
    return api.index < api.historic.length;
}
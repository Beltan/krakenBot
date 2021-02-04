var api = require('./api/apiWrapper');
var ai = require('./ai/aiCore');
var config = require('./config').api;

var data = [];

function continues() {
    return api.continue() && ai.continue();
}

exports.main = async function() {

    console.log("Started");

    api.init();
    ai.init();

    console.log("Started processing values");
    while (continues()){
        var values = await api.getValues();
        if (values) {
            var instructions = ai.decide(values);
            await api.execute(instructions);
        }
       
    }

    console.log("Finished");
    // we could for example save in a csv all the data history... 
}

exports.state = function() {
    // we return the last data object when asked for the state
    return data[data.length - 1];   
}

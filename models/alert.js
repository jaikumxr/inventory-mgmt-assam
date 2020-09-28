var mongoose = require("mongoose");

var alertSchema = new mongoose.Schema({
    users: {type:[
        {type:mongoose.Types.ObjectId,
        default:undefined}
    ]},
    value: String, //name of Item or Location
    items: {type: [
        {type:Number,
        default: 0}
    ]} 
});

module.exports = mongoose.model("Alert", alertSchema);
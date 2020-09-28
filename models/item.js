var mongoose = require("mongoose");

var itemSchema = new mongoose.Schema({
    iname: String,
    itemid: Number,
    icount: {type: Number, default: 0},
    location: {type: String, default: ""},
    itype: {type: String, default: ""},
    comments: {type: String, default: ""},
    publishedDate: Date,
    lastModifiedDate: Date,
    addedBy: {type:mongoose.Types.ObjectId, default:undefined},
    modList: {type: [
        {
        user: {type:mongoose.Types.ObjectId, default:undefined},
        modDate: {type: Date}
        }
    ]}

});

module.exports = mongoose.model("Item", itemSchema);

var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  firstName: {type:String, default:""},
  lastName: {type:String, default:""},
  email: {type:String, default:""},
  isAdmin: {type:Boolean, default:false},
  subscriptions: {type:[
    {type:String}
  ]},
  assamese: {type:Boolean, default: false}
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);

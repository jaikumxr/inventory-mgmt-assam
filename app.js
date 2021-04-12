const methodOverride = require("method-override")
const express = require("express")
const app = express()
const mongoose = require("mongoose")
const passport = require("passport")
const LocalStrategy = require("passport-local")
const User = require("./models/user")
const flash = require("connect-flash")

//Route headers
const homeRoutes = require("./routes/home")
const inventoryRoutes = require("./routes/inventory")
const searchRoutes = require("./routes/search")
const manageInvRoutes = require("./routes/manage")
const subscriptionRoutes = require("./routes/subscriptions")
const loginRoutes = require("./routes/login")
const dashboardRoutes = require("./routes/dashboard")
const exportRoutes = require("./routes/export")

//edit mongoose configuration for your Cloud Database. If using local, don't change
mongoose.connect("mongodb://localhost:27017/ims", {
  useNewUrlParser: true,
  'useUnifiedTopology': true
})
mongoose.set('useFindAndModify', false)

// APP CONFIG
app.set("view engine", "ejs")
app.use(express.static("public"))
app.use(methodOverride("_method"))
app.use(flash())
app.use(express.json())
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.use(require("express-session")({
  secret: "masteroogway",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

//Routes
app.use(homeRoutes)

app.use(inventoryRoutes)

app.use(searchRoutes)

app.use(manageInvRoutes)

app.use(subscriptionRoutes)

app.use(loginRoutes)

app.use(dashboardRoutes)

app.use(exportRoutes)

//export routes


//uncomment this to create initial admin user

// var newUser = {"username":"admin","isAdmin":true,"email":"jai@example.com"};
// var password = "admin";
// User.register(newUser, password, function(err,user){
//   if(err){
//     console.log(err);
//   }
// });

//HEROKU/SERVER CONFIG

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
  console.log("IMS is up");
});
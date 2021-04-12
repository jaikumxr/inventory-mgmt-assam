const express = require('express')
const router = express.Router()
const passport = require("passport")
const LocalStrategy = require("passport-local")
const User = require("../models/user")


passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//show login form
router.get("/login", (req, res) => {
    res.render("login");
});

//handling login logic
router.post("/login", passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: true
}), () => { });

//logout ROUTE
router.get("/logout", (req, res) => {
    req.logout();
    req.flash("success", "Successfully logged out");
    res.redirect("/login");
});

module.exports = router

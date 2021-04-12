const express = require('express')
const router = express.Router()
const isLoggedIn = require("../middlewares/isLoggedIn")



router.get("/", (req, res) => {
    res.redirect("/home");
});

router.get("/home", isLoggedIn, (req, res) => {
    res.render("home", {
        currentUser: req.user
    });
});

module.exports = router


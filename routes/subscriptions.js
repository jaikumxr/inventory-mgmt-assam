const express = require('express')
const router = express.Router()
const Alert = require('../models/alert')
const isLoggedIn = require("../middlewares/isLoggedIn")

router.get('/subscriptions', isLoggedIn, (req, res) => {
    let allSubs = []
    Alert.find({}, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            allSubs = result
        }
    })
    Alert.find({ users: req.user._id }, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            res.render('subscriptions', {
                currentUser: req.user,
                subs: result,
                allSubs: allSubs
            })
        }
    })
})

router.post('/subscribe', isLoggedIn, (req, res) => {
    Alert.findOneAndUpdate({ value: req.body.keyword }, { $push: { users: req.user._id } }, (err) => {
        if (err) {
            console.log(err);
            req.flash("error", "Could not subscribe. Keyword does not exist");
            res.redirect("/subscriptions");
        } else {
            req.flash("success", "Successfully subscribed to " + req.body.keyword);
            res.redirect("/subscriptions");
        }
    })
})
router.post('/unsubscribe', isLoggedIn, (req, res) => {
    Alert.findOneAndUpdate({ value: req.body.keyword }, { $pull: { users: req.user._id } }, (err) => {
        if (err) {
            console.log(err);
            req.flash("error", "Could not unsubscribe. Keyword does not exist");
            res.redirect("/subscriptions");
        } else {
            req.flash("success", "Successfully unsubscribed from " + req.body.keyword);
            res.redirect("/subscriptions");
        }
    })
})

module.exports = router
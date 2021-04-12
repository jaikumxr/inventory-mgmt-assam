const express = require('express')
const router = express.Router()
const Item = require('../models/item')
const User = require('../models/user')
const isLoggedIn = require("../middlewares/isLoggedIn")




router.get("/profile/:id", function (req, res) {
    res.render("profile", {
      currentUser: req.user,
    });
  });
  

router.post("/togglelang", isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err);
        } else {
            User.findByIdAndUpdate(req.user._id, { assamese: !user.assamese }, (err) => {
                if (err) {
                    console.log(err);
                } else {
                    req.flash("success", "Success! | সফল!")
                    res.redirect("/home")
                }
            })
        }
    })
})

router.get("/inventory", isLoggedIn, (req, res) => {
    Item.find({}, (err, items) => {
        res.render("inventory", {
            currentUser: req.user,
            items: items,
            editEnable: false
        })
    })
});

router.get("/inventory/item/:id", isLoggedIn, (req, res) => {
    Item.findById(req.params.id, (err1, item) => {
        User.findById(item.addedBy, (err2, adder) => {
            res.render("showItem", {
                currentUser: req.user,
                items: [
                    {
                        itemObj: item,
                        adder: adder,
                    }
                ],
                result: false
            })
        })
    })
})

module.exports = router
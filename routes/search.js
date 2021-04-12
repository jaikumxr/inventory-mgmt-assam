const express = require('express')
const router = express.Router()
const Item = require('../models/item')
const isLoggedIn = require("../middlewares/isLoggedIn")


router.get("/search/", isLoggedIn, (req, res) => {
    res.render("search", {
        currentUser: req.user
    })
})

router.post("/search/id", isLoggedIn, (req, res) => {
    const renderItems = []
    try {
        Item.find({ itemid: (req.body.itemid ? req.body.itemid : 0) }, (err, items) => {
            if (err) {
                console.log(err);
            } else {
                items.forEach((item) => {
                    renderItems.push({ itemObj: item })
                })
                if (items.length > 0) {
                    return res.render("showItem", {
                        currentUser: req.user,
                        items: renderItems,
                        result: true,
                        error: (renderItems.length > 1 ? "Multiple entries found with the same ID. Please update database" : null),
                        success: (renderItems.length == 1 ? "Found 1 item" : null)
                    })
                } else {
                    req.flash("error", "No items found with this ID");
                    return res.redirect("/search");
                }
            }
        })
    }
    catch (err) {
        req.flash("error", "An error occured. Please try again")
        res.redirect("/search")
        console.log(err);
    }
})

router.post("/search/parameters", isLoggedIn, (req, res) => {
    searchObj = {
        "lastModifiedDate": {
            $gt: (new Date(req.body.first)).toJSON(),
            $lt: (new Date(req.body.second)).toJSON()
        },
        itype: req.body.type
    }
    if (req.body.type == "Other") {
        delete searchObj.itype;
    }
    Item.find(searchObj, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            if (result.length > 0) {
                const renderItems = []
                result.forEach((item) => {
                    renderItems.push({
                        itemObj: item
                    })
                });
                return res.render("showItem", {
                    items: renderItems,
                    success: "No. of items found: " + result.length,
                    result: true
                });
            } else {
                req.flash("error", "No items found. Please check your search criteria.");
                return res.redirect("/search");
            }
        }
    });
});

module.exports = router
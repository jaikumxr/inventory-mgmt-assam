const express = require('express')
const router = express.Router()
const Item = require('../models/item')
const User = require('../models/user')
const Alert = require('../models/alert')
const isLoggedIn = require("../middlewares/isLoggedIn")

//edit credentials for your mailer
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'jaime.pollich@ethereal.email',
    pass: 'XesV4C5VB6PeFA42yt'
  }
});

router.get("/inventory/manage", isLoggedIn, (req, res) => {
    res.render("manage", {
        currentUser: req.user
    })
})

router.get("/inventory/add", isLoggedIn, (req, res) => {
    res.render("new", {
        currentUser: req.user
    })
})

router.post("/inventory/add", isLoggedIn, (req, res) => {
    const newDate = new Date()
    const addObj = {
        itemid: req.body.itemid,
        iname: req.body.iname,
        itype: req.body.itype,
        icount: req.body.icount,
        location: req.body.location,
        publishedDate: newDate,
        lastModifiedDate: newDate,
        addedBy: req.user._id,
        modList: [
            {
                user: req.user._id,
                modDate: newDate
            }
        ]
    }

    Alert.updateMany({}, { items: [], count: 0 }, async (err, response) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Cleared alerts.');
        }
    }).then(() => {
        Alert.find({}, (err, alerts) => {
            if (err) {
                console.log(err);
            } else {
                alerts.forEach((alert) => {
                    let counter = false;
                    if (alert.value == addObj.iname || alert.value == addObj.itype || alert.value == addObj.location) {
                        counter = true;
                    }
                    if (counter) {
                        Alert.findOneAndUpdate({ value: alert.value }, { $push: { items: addObj.itemid } }, (err) => {
                            if (err) {
                                console.log(err);
                            }
                        })
                    }
                })
                let subUsers = [];
                Alert.find({}, (err, alerts) => {
                    if (err) {
                        console.log(err);
                    } else {
                        alerts.forEach((alert) => {
                            alert.users.forEach((user) => {
                                subUsers.push({ userid: user, keyword: alert.value, items: alert.items });
                            });
                        });
                        subUsers.forEach((item) => {
                            console.log(item.userid);
                            User.findById(item.userid, (err, foundUser) => {
                                if (foundUser) {
                                    console.log("Sending mail to " + foundUser.email);
                                    let mailOptions = {
                                        from: "noreply@ims",
                                        to: foundUser.email,
                                        subject: "New item from your subscription",
                                        text: `
                                        Dear ` + foundUser.username + `,
                                        This is an auto-generated email.
                                        There is a new item from one of your subscribed keyword:  `+ item.keyword + `     
                                        Thanks
                                        IMS
                                        `
                                    }
                                    transporter.sendMail(mailOptions, (err, data) => {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            console.log("Email Sent");
                                        }
                                    });
                                } else {
                                    console.log("No user found " + item.userid);
                                }
                            });
                        });
                    }
                });
            }
        })

    });

    Item.create(addObj, (err) => {
        if (err) {
            console.log(err);
            req.flash("error", "Something went wrong. Please try again");
            res.redirect("/home");
        } else {
            req.flash("success", "Successfully added " + addObj.iname + " to inventory")
            res.redirect("/home");
        }
    })
})

router.get("/inventory/edit", isLoggedIn, (req, res) => {
    Item.find({}, (err, items) => {
        res.render("inventory", {
            currentUser: req.user,
            items: items,
            editEnable: true
        })
    })
})

router.get("/inventory/edit/:id", isLoggedIn, (req, res) => {
    Item.findById(req.params.id, (err, item) => {
        if (err) {
            console.log(err);
        } else {
            res.render("editItem", {
                currentUser: req.user,
                item: item
            })
        }
    })
});

router.put("/inventory/edit/:id", isLoggedIn, (req, res) => {
    const newDate = new Date()
    const addObj = {
        itemid: req.body.itemid,
        iname: req.body.iname,
        itype: req.body.itype,
        icount: req.body.icount,
        location: req.body.location,
        lastModifiedDate: newDate,
        $push: {
            modList: { user: req.user._id, modDate: newDate }
        }
    }
    Item.findByIdAndUpdate(req.params.id, addObj, (err) => {
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "Successfully edited " + req.body.iname)
            res.redirect("/inventory");
        }
    })
})

router.delete("/inventory/remove/:id", isLoggedIn, (req, res) => {
    Item.findByIdAndRemove(req.params.id, (err) => {
        if (err) {
            req.flash("error", "Could not remove item");
            res.redirect("/inventory")
        } else {
            req.flash("success", "Removed item");
            res.redirect("/inventory");
        }
    });
});

module.exports = router
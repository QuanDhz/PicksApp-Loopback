'use strict';
var async = require('async');
var Promise = require('bluebird');

/**
* Adds a participant to a group.
* @param {Model} Group Model used for staic operations.
* @param {object} group Model instance representing the group.
* @param {number} userId Model id of the user to join.
* @param {Function(Error)} callback
*/
function addParticipant(Group, group, userId, callback) {
  var Score = Group.app.models.Score;
  var Season = Group.app.models.Season;
  let newScore;
  // Create score for user
  Score.create({participant: userId, season: group.currentSeason})
  .then(function(createdScore) {
    newScore = createdScore;
    // Update current season
    return Season.findById(group.currentSeason);
  })
  .then(function(season) {
    season.scores.push(newScore.id);
    return season.save();
  })
  .then(function(updatedSeason) {
    callback(null);
  })
  .catch(function(error) {
    console.log('Error adding participant');
    callback(error);
  });
}

module.exports = function(Group) {
  // Disable endpoints not needed
  Group.disableRemoteMethod('upsert', true);
  Group.disableRemoteMethod('upsertWithWhere', true);
  Group.disableRemoteMethod('updateAll', true);
  Group.disableRemoteMethod('updateAttributes', false);
  Group.disableRemoteMethod('updateAttribute', false);
  Group.disableRemoteMethod('verify', false);
  Group.disableRemoteMethod('replaceOrCreate', true);
  Group.disableRemoteMethod('replaceById', true);
  Group.disableRemoteMethod('createChangeStream', true);
  Group.disableRemoteMethod('find', true);
  Group.disableRemoteMethod('findOne', true);
  Group.disableRemoteMethod('deleteById', true);
  Group.disableRemoteMethod('confirm', true);
  Group.disableRemoteMethod('count', true);
  Group.disableRemoteMethod('exists', true);

  // Remote Methods

  /**
  * Gets a list of users that are part of the group.
  * @param {Function(Error, array)} callback
  */
  Group.prototype.participantsInGroup = function(req, callback) {
    var groupId = req.params['id'];
    var PicksUser = Group.app.models.PicksUser;
    var participants = [];
    Group.findById(groupId)
    .then(function(group) {
      if (group.participants) {
        async.eachLimit(group.participants, 1, function(id, cb) {
          PicksUser.findById(id)
          .then(function(user) {
            participants.push(user);
            cb();
          })
          .catch(function(error) {
            cb(error);
          });
        }, function(error) {
          if (error) {
            return Promise.reject(error);
          } else {
            callback(null, participants);
          }
        });
      } else {
        callback(null, []);
      }
    })
    .catch(function(error) {
      callback(error, null);
    });
  };

  /**
  * Allows an user to join a public group.
  * @param {number} userId Model id of the user that wants to join the group.
  * @param {Function(Error)} callback
  */
  Group.prototype.join = function(userId, req, callback) {
    var groupId = req.params['id'];
    // Get the group from the database
    Group.findById(groupId)
    .then(function(group) {
      // First check if the user is already participanting
      if (group.creator == userId) {
        // The creator is technically already in the group
        console.log('Creator is already in group');
        var creatorInGroupError = new Error();
        creatorInGroupError.status = 400;
        creatorInGroupError.message = 'Creator is already in group.';
        creatorInGroupError.code = 'BAD_REQUEST';
        callback(creatorInGroupError);
      } else if (group.participants === null) {
        // Create the first participant
        console.log('Adding first user');
        var participants = [];
        group.participants = participants;
        addParticipant(Group, group, userId, function(error) {
          if (error) {
            callback(error);
          } else {
            callback(null);
          }
        });
      } else if (group.participants.includes(userId)) {
        // User is already in group
        console.log('User is alrady in group');
        var userInGroupError = new Error();
        userInGroupError.status = 400;
        userInGroupError.message = 'User is already in group.';
        userInGroupError.code = 'BAD_REQUEST';
        callback(userInGroupError);
      } else {
        // Add a new participant
        console.log('Add additional user');
        addParticipant(Group, group, userId, function(error) {
          if (error) {
            callback(error);
          } else {
            callback(null);
          }
        });
      }
    })
    .catch(function(error) {
      callback(error);
    });
  };

  /**
  * Finds all instances of the model based on a participant.
  * @param {number} participantId Model id of the user that is part of a group.
  * @param {boolean} isPrivate Boolean value that determines if a group is
                               public or private.
  * @param {Function(Error, array)} callback
  */
  Group.groupsForParticipants = function(participantId, isPrivate, callback) {
    // Build filter object
    var filterObject = {};
    if (isPrivate) {
      filterObject['isprivate'] = isPrivate;
    }
    // Find groups based on filter object
    Group.find({where: filterObject})
    .then(function(results) {
      if (participantId) {
        results = results.filter(function(group) {
          if (group.participants) {
            return group.participants.includes(participantId);
          } else {
            return false;
          }
        });
        callback(null, results);
      } else {
        callback(null, results);
      }
    })
    .catch(function(error) {
      callback(error, null);
    });
  };

  /**
  * Finds all instances of the model based on a creator.
  * @param {number} creatorId Model id of the user that created a group.
  * @param {boolean} isPrivate Boolean value that determines if a group is
                               public or private.
  * @param {Function(Error, array)} callback
  */
  Group.groupsForCreator = function(creatorId, isPrivate, callback) {
    // Build filter object
    var filterObject = {};
    if (creatorId) {
      filterObject['creator'] = creatorId;
    }
    if (isPrivate) {
      filterObject['isprivate'] = isPrivate;
    }
    // Find groups based on filter object
    Group.find({where: filterObject})
    .then(function(results) {
      callback(null, results);
    })
    .catch(function(error) {
      console.log('Error getting objects');
      callback(error, null);
    });
  };

  // Remote hooks

  /**
  * Creates a season for the newly created group. The season will default to
  * the current one.
  * @param {string} methodName Name of the method to fire the hook after
                               completion.
  * @param {Function(object, object, Function())} callback
  */
  Group.afterRemote('create', function(ctx, modelInstance, next) {
    // Get the current season and week of the NFL
    var Nfl = Group.app.models.Nfl;
    var Season = Group.app.models.Season;
    var Week = Group.app.models.Week;
    var Score = Group.app.models.Score;
    let nfl, newSeason, newWeek;
    Nfl.find()
    .then(function(results) {
      nfl = results[0];
      // Create season for group
      return Season.create({season: nfl.currentSeason,
                            group: modelInstance.id});
    })
    .then(function(season) {
      newSeason = season;
      // Create week for season
      return Week.create({season: newSeason.id, week: nfl.currentWeek});
    })
    .then(function(week) {
      newWeek = week;
      // Create score for created season of the group creator
      return Score.create({participant: modelInstance.creator,
                           season: newSeason.id});
    })
    .then(function(score) {
      // Update created season
      newSeason.scores = [score.id];
      newSeason.week = newWeek.id;
      return newSeason.save();
    })
    .then(function(updatedSeason) {
      newSeason = updatedSeason;
      // Update created group
      modelInstance.currentSeason = newSeason.id;
      return modelInstance.save();
    })
    .then(function(updatedGroup) {
      next();
    })
    .catch(function(error) {
      console.log(error);
      next();
    });
  });
};

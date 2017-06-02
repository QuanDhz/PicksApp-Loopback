'use strict';
var Promise = require('bluebird');

module.exports = function(Schedule) {
  // Remote Methods

  /**
  * Finds historical score data based on a given season and week.
  * @param {number} leagueType The sports league to get a schedule from. For
                               NFL, use 0.
  * @param {number} season The season in the league represented by a year.
  * @param {number} week The week in the given season.
  * @param {Function(Error, array)} callback
  */
  Schedule.historical = function(leagueType, season, week, callback) {
    var ScheduleScrapper = Schedule.app.dataSources.ScheduleScrapper;
    ScheduleScrapper.historical(leagueType, season, week)
    .then(function(result) {
      callback(null, result);
    })
    .catch(function(error) {
      console.log('Error retrieving schedule');
      callback(error, null);
    });
  };

  /**
  * Finds live, granular score data on a given season and week.
  * @param {number} leagueType The sports league to get a schedule from. For
                               NFL, use 0.
  * @param {number} season The season in the league represented by a year.
  * @param {number} week The week in the given season.
  * @param {Function(Error, array)} callback
  */
  Schedule.live = function(leagueType, season, week, callback) {
    var ScheduleScrapper = Schedule.app.dataSources.ScheduleScrapper;
    ScheduleScrapper.live(leagueType, season, week)
    .then(function(result) {
      callback(null, result);
    })
    .catch(function(error) {
      console.log('Error getting live schedule');
      callback(error, null);
    });
  };
};

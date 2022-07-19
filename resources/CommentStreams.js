/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

var commentstreams_controller = ( function () {
	'use strict';

	return {
		baseUrl: null,
		imagepath: null,
		targetComment: null,
		isLoggedIn: false,
		canComment: false,
		moderatorEdit: false,
		moderatorDelete: false,
		moderatorFastDelete: false,
		showLabels: false,
		userDisplayName: null,
		newestStreamsOnTop: false,
		initiallyCollapsed: false,
		areNamespaceEnabled: false,
		enableVoting: false,
		enableWatchlist: false,
		comments: [],
		discourseTopicId: false,
		spinnerOptions: {
			lines: 11, // The number of lines to draw
			length: 8, // The length of each line
			width: 4, // The line thickness
			radius: 8, // The radius of the inner circle
			corners: 1, // Corner roundness (0..1)
			rotate: 0, // The rotation offset
			direction: 1, // 1: clockwise, -1: counterclockwise
			color: '#000', // #rgb or #rrggbb or array of colors
			speed: 1, // Rounds per second
			trail: 60, // ƒfterglow percentage
			shadow: false, // Whether to render a shadow
			hwaccel: false, // Whether to use hardware acceleration
			className: 'spinner', // The CSS class to assign to the spinner
			zIndex: 2e9, // The z-index (defaults to 2000000000)
			top: '50%', // Top position relative to parent
			left: '50%' // Left position relative to parent
		},
		initialize: function () {
			this.baseUrl = window.location.href.split(/[?#]/)[0];
			this.imagepath = mw.config.get('wgExtensionAssetsPath') +
				'/CommentStreams/images/';
			if (window.location.hash) {
				var hash = window.location.hash.substring(1);
				var queryIndex = hash.indexOf('?');
				if (queryIndex !== -1) {
					hash = hash.substring(0, queryIndex);
				}
				this.targetComment = hash;
			}
			this.isLoggedIn = mw.config.get('wgUserName') !== null;
			var config = mw.config.get('CommentStreams');
			this.canComment = config.canComment;
			this.moderatorEdit = config.moderatorEdit;
			this.moderatorDelete = config.moderatorDelete;
			this.moderatorFastDelete = this.moderatorDelete ?
				config.moderatorFastDelete : false;
			this.showLabels = config.showLabels;
			this.userDisplayName = config.userDisplayName;
			this.newestStreamsOnTop = config.newestStreamsOnTop;
			this.initiallyCollapsed = config.initiallyCollapsed;
			this.areNamespaceEnabled = config.areNamespaceEnabled;
			this.enableVoting = config.enableVoting;
			this.enableWatchlist = config.enableWatchlist;
			this.comments = config.comments;
			this.discourseTopicId = config.discourseTopicId;
			this.DiscourseURL = config.DiscourseURL;
			this.setupDivs();

			if (this.targetComment) {
				this.scrollToAnchor(this.targetComment);
			}
		},
		scrollToAnchor: function (id) {
			var element = $('#' + id);
			if (element.length) {
				$('html,body').animate({ scrollTop: element.offset().top }, 'slow');
			}
		},
		setupDivs: function () {
			var self = this;

			if (self.areNamespaceEnabled && $('#cs-comments.cs-comments').length === 0) {
				var mainDiv = $('<div>').attr('class', 'cs-comments').attr('id', 'cs-comments');
				mainDiv.insertAfter('#catlinks');
			}
			$('.cs-comments').each(function () {
				var commentDiv = $(this);

				var headerDiv = $('<div>').attr('class', 'cs-header');
				// For backwards compatibility. Please remove in ver 6.0
				if (commentDiv.attr('id') === 'cs-comments') {
					headerDiv.attr('id', 'cs-header');
				}
				commentDiv.append(headerDiv);

				var footerDiv = $('<div>').attr('class', 'cs-footer');
				// For backwards compatibility. Please remove in ver 6.0
				if (commentDiv.attr('id') === 'cs-comments') {
					footerDiv.attr('id', 'cs-footer');
				}
				commentDiv.append(footerDiv);

				if (self.canComment) {
					var addButton = self.createNeayiAddButton(self.discourseTopicId);

					// For backwards compatibility. Please remove in ver 6.0
					if (commentDiv.attr('id') === 'cs-comments') {
						addButton.attr('id', 'cs-add-button');
					}

					footerDiv.append(addButton);
				}

				// Start Neayi : When the user is not connected, we show a button anyway
				else {
					var addButtonDiv = $('<div> ')
						.addClass('cs-add-div');

					var addButton = $('<button>')
						.attr({
							type: 'button',
							id: 'cs-add-button',
							title: mw.message('commentstreams-buttontext-Neayi-connecttocomment'),
							'data-toggle': 'tooltip'
						})
						.addClass('cs-button rounded');

					var addCommentFA = $('<i>')
						.addClass('fas fa-comment');
					addButton.append(addCommentFA);

					if (self.showLabels) {
						var addLabel = $('<span>')
							.text(mw.message('commentstreams-buttontext-Neayi-connecttocomment'))
							.addClass('cs-comment-button-label');
						addButton.append(addLabel);
					}

					addButtonDiv.append(addButton);

					footerDiv.append(addButtonDiv);

					addButton.click(function () {
						var wgPageName = mw.config.get('wgPageName');
						window.location = mediaWiki.util.getUrl("Special:Connexion", { returnto: wgPageName });
					});

				}

				commentDiv.append($(`<div id='discourse-comments'></div>`));

				if (self.discourseTopicId)
				{
					window.DiscourseEmbed = {
						discourseUrl: self.DiscourseURL + '/',
						topicId: self.discourseTopicId,
						discourseReferrerPolicy: 'strict-origin-when-cross-origin'
					};

					(function () {
						var d = document.createElement('script'); d.type = 'text/javascript'; d.async = true;
						d.src = window.DiscourseEmbed.discourseUrl + 'javascripts/embed.js';
						(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(d);
					})();
				}
			});
		},

		createNeayiAddButton: function (discourseTopicId) {
			var self = this;

			var addButtonDiv = $('<div> ')
				.addClass('cs-add-div');

			var targetURL = '';
			if (discourseTopicId)
				targetURL = self.DiscourseURL + '/t/' + discourseTopicId;
			else
				targetURL = '/wiki/Special:RedirectToForum/page/' + mw.config.get('wgArticleId');

			var addButton = $('<a>')
						.attr({
							'href': targetURL,
							'target': '_blank',
							'class': 'cs-add-button',
							'title': mw.message('commentstreams-buttontext-Neayi-askquestion'),
							'data-toggle': 'tooltip'
						})
						.addClass('cs-button rounded');

			var addCommentFA = $('<i>')
				.addClass('fas fa-comment');
			addButton.append(addCommentFA);

			var addLabel = $('<span>')
				.text(mw.message('commentstreams-buttontext-Neayi-askquestion'))
				.addClass('cs-comment-button-label');
			addButton.append(addLabel);

			addButtonDiv.append(addButton);

			return addButtonDiv;
		}

	};
}());

window.CommentStreamsController = commentstreams_controller;

(function () {
	$(document)
		.ready(function () {
			if (mw.config.exists('CommentStreams')) {
				window.CommentStreamsController.initialize();
			}
		});
}());



$(document).ready(function () {

	// show/hide overflow

	$('.show-all a').each(function () {

		$(this).click(function () {
			var currentBlock = $(this).parents('.cs-comment-header');
			currentBlock.toggleClass('expanded');
			if (currentBlock.hasClass('expanded')) {
				$(this).find('span').text('keyboard_arrow_up');
			}
			else if (!currentBlock.hasClass('expanded')) {
				$(this).find('span').text('keyboard_arrow_down');
			}
		});

	});

});
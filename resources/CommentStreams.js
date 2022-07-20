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
		isLoggedIn: false,
		areNamespaceEnabled: false,
		discourseTopicId: false,

		initialize: function () {

			this.isLoggedIn = mw.config.get('wgUserName') !== null;
			var config = mw.config.get('CommentStreams');
			this.areNamespaceEnabled = config.areNamespaceEnabled;
			this.discourseTopicId = config.discourseTopicId;
			this.DiscourseURL = config.DiscourseURL;
			this.setupDivs();

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

				var footerDiv = $('<div>').attr('class', 'cs-footer');
				// For backwards compatibility. Please remove in ver 6.0
				if (commentDiv.attr('id') === 'cs-comments') {
					footerDiv.attr('id', 'cs-footer');
				}
				commentDiv.append(footerDiv);

				if (self.isLoggedIn) {
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
						.addClass('cs-add-button cs-button rounded');

					var addCommentFA = $('<i>')
						.addClass('fas fa-comment');
					addButton.append(addCommentFA);

					var addLabel = $('<span>')
						.text(mw.message('commentstreams-buttontext-Neayi-connecttocomment'))
						.addClass('cs-comment-button-label');
					addButton.append(addLabel);

					addButtonDiv.append(addButton);

					footerDiv.append(addButtonDiv);

					addButton.click(function () {
						var wgPageName = mw.config.get('wgPageName');
						window.location = mediaWiki.util.getUrl("Special:Connexion", { returnto: wgPageName });
					});

				}

				commentDiv.append($(`<div id='discourse-comments'></div>`));

				// Now add the discourse embed
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

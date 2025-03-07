﻿/*
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

var DiscourseIntegration_controller = ( function () {
	'use strict';

	return {
		isLoggedIn: false,

		initialize: function () {

			this.isLoggedIn = mw.config.get('wgUserName') !== null;
			var config = mw.config.get('DiscourseIntegration');

			this.DiscourseURL = config.DiscourseURL;
			
			if ($('#di-disable-comments').length > 0)
				return;

			// Also don't load the comments on iframes. Period.
			if (mw.config.get('wgCanonicalNamespace') == 'Iframe')
				return;

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

			if ($('#di-comments.di-comments').length === 0) {
				var mainDiv = $('<div>').attr('class', 'di-comments').attr('id', 'di-comments');
				mainDiv.insertAfter('#catlinks');
			}

			$('.di-comments').each(function () {
				var commentDiv = $(this);

				var footerDiv = $('<div>').attr('class', 'di-footer');
				// For backwards compatibility. Please remove in ver 6.0
				if (commentDiv.attr('id') === 'di-comments') {
					footerDiv.attr('id', 'di-footer');
				}
				commentDiv.append(footerDiv);

				if (self.isLoggedIn) {
					var addButton = self.createNeayiAddButton();

					// For backwards compatibility. Please remove in ver 6.0
					if (commentDiv.attr('id') === 'di-comments') {
						addButton.attr('id', 'di-add-button');
					}

					footerDiv.append(addButton);
				}

				// Start Neayi : When the user is not connected, we show a button anyway
				else {
					var addButtonDiv = $('<div> ')
						.addClass('di-add-div');

					var addButton = $('<button>')
						.attr({
							type: 'button',
							id: 'di-add-button',
							title: mw.message('discourseintegration-buttontext-connecttocomment'),
							'data-toggle': 'tooltip'
						})
						.addClass('di-add-button di-button rounded');

					var addCommentFA = $('<i>')
						.addClass('fas fa-comment');
					addButton.append(addCommentFA);

					var addLabel = $('<span>')
						.text(mw.message('discourseintegration-buttontext-connecttocomment'))
						.addClass('di-comment-button-label');
					addButton.append(addLabel);

					addButtonDiv.append(addButton);

					footerDiv.append(addButtonDiv);

					addButton.click(function () {
						var wgPageName = mw.config.get('wgPageName');
						window.location = mediaWiki.util.getUrl("Special:Connexion", { returnto: wgPageName });
					});

				}

				// Now add the discourse embed
				commentDiv.append($(`<div id='discourse-comments'></div>`));

				var pageId = mw.config.get('wgArticleId');
				var api = new mw.Api();

				api.post( {
					action: 'digettopicid',
					pageid: pageId
				} )
				.done( function ( data ) {
					var topicID = data.digettopicid.topicID;

					if (topicID > 0)
					{
						window.DiscourseEmbed = {
							discourseUrl: self.DiscourseURL + '/',
							topicId: topicID,
							discourseReferrerPolicy: 'strict-origin-when-cross-origin'
						};

						(function () {
							var d = document.createElement('script'); d.type = 'text/javascript'; d.async = true;
							d.src = window.DiscourseEmbed.discourseUrl + 'javascripts/embed.js';
							(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(d);
						})();

						$(".di-comment-button-label").html("Continuer la discussion");
					}
				} );
			});
		},

		createNeayiAddButton: function () {
			var self = this;

			var addButtonDiv = $('<div> ')
				.addClass('di-add-div');

			var targetURL = '/wiki/Special:RedirectToForum/page/' + mw.config.get('wgArticleId');

			var addButton = $('<a>')
						.attr({
							'href': targetURL,
							'target': '_blank',
							'class': 'di-add-button',
							'title': mw.message('discourseintegration-buttontext-askquestion'),
							'data-toggle': 'tooltip'
						})
						.addClass('di-button rounded');

			var addCommentFA = $('<i>')
				.addClass('fas fa-comment');
			addButton.append(addCommentFA);

			var addLabel = $('<span>')
				.text(mw.message('discourseintegration-buttontext-askquestion'))
				.addClass('di-comment-button-label');
			addButton.append(addLabel);

			addButtonDiv.append(addButton);

			return addButtonDiv;
		}

	};
}());

window.DiscourseIntegrationController = DiscourseIntegration_controller;

(function () {
	$(document)
		.ready(function () {
			if (mw.config.exists('DiscourseIntegration')) {
				window.DiscourseIntegrationController.initialize();
			}
		});
}());

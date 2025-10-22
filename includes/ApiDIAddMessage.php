<?php
/*
 * Copyright (c) 2017 The MITRE Corporation
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

namespace MediaWiki\Extension\DiscourseIntegration;

use ApiBase;
use Wikimedia\ParamValidator\ParamValidator;

use SMW\DIWikiPage;
use SMW\DIProperty;
use SMW\StoreFactory;
use SMWQuery;
use SMW\Query\Language\SomeProperty;
use SMW\Query\Language\ValueDescription;


class ApiDIAddMessage extends ApiDIBase {

	/**
	 * @param ApiMain $main main module
	 * @param string $action name of this module
	 */
	public function __construct( $main, $action ) {
		parent::__construct( $main, $action, true );
	}

	/**
	 * the real body of the execute function
	 *
	 * @return result of API request
	 */
	protected function executeBody() {
		$params = $this->extractRequestParams();
		$message = $params['message'];

        $api = $this->getDiscourseAPI();

		// First, get the page info:
		$wikiTitle = $this->currentPage->getTitle();

		$username = $this->getCurrentlyLoggedInUser();

		$pageId = $wikiTitle->getArticleID();

		$topicId = $api->getTopicIdByExternalID($pageId);

		if (!$topicId) {
			wfDebugLog( 'DiscourseIntegration', "Creating topic for : $wikiTitle");

			// Get the tags associated with the page
			$tags = $this->getTagsForPage($wikiTitle);

			// Create the topic now
			$pageURL = $wikiTitle->getFullURL('', false, 'https://');
			$text = "Ce sujet de discussion accompagne la page :\n\n\n$pageURL";
	
			// create a topic
			$topicId = $api->createTopicForEmbed2(
				'Discussion - ' . $wikiTitle,
				$text,
				$GLOBALS['wgDiscourseDefaultCategoryId'],
				$tags,
				$username,
				$pageURL,
				$pageId
			);
	
			if (empty($topicId))
				$this->dieCustomUsageMessage('discourseintegration-api-error-create-topic');	

			if ($topicId->apiresult->errors)
				$this->dieCustomUsageMessage('discourseintegration-api-error-create-topic-details');

			$this->addInsightsFollower($pageId, $topicId);
		}

		$r = [];
		$ret = $api->createPost($message, $topicId, $username);
		if ($ret->apiresult->errors){	
			$r['status'] = 'error';
			$r['errors'] = $ret->apiresult->errors;
		} else {
			$r['status'] = 'success';
			$r['topicId'] = $topicId;	
		}

		$apiResult = $this->getResult();
		$apiResult->addValue( null, $this->getModuleName(), $r );
	}

	/**
	 * Find the Discourse username for the currently logged in user on the wiki.
	 * If the user does not exists, create it
	 */
	function getCurrentlyLoggedInUser()
	{
		// Find the email of the logged in user
		$user = $this->getUser();
		if ( $user->isAnon() ) {
			// Should not be possible, this is a special
		}

		$userEmail = $this->getCurrentUserEmail();

		// Find the user on discourse
		$api = $this->getDiscourseAPI();
        $username = $api->getUsernameByEmail($userEmail);
        if (!empty($username))
	        return $username;

		// Not found ? Create it now (it will be synched properly by insights later)
		return $api->createDiscourseUser($user);
	}

	function getCurrentUserEmail()
	{
		$user = $this->getUser();
		if ( $user->isAnon() ) {
			$this->dieCustomUsageMessage('discourseintegration-api-error-not-logged-in');
		}

		$userEmail = $user->getEmail();
		$userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

		return $userEmail;
	}

	public function getAllowedParams() {
		return [
			'pageid' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => true
			],
			'message' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => true,
			]
		];
	}

	/**
	 * @return array examples of the use of this API module
	 */
	public function getExamplesMessages() {
		return [
			'action=' . $this->getModuleName() . '&pageid=3' => 'apihelp-' . $this->getModuleName() . '-pageid-example'
		];
	}

	public function mustBePosted() {
		return true;
	}
	
	/**
	 * @return string indicates that this API module does not require a CSRF toekn
	 */
	public function needsToken() {
		return 'csrf';
	}

	function addInsightsFollower($pageId, $topicId)
	{
		$usernames = $this->getFollowingUsersForArticle($pageId);

		$api = $this->getDiscourseAPI();
		foreach ($usernames as $username)
		{
			$api->watchTopic($topicId, $username);
		}
	}

	/**
	 * Get the tags associated with a page
	 *
	 * @param Title $title
	 * @return array of tags
	 */
	function getTagsForPage($title) {
				
		$smwStore = StoreFactory::getStore();

		$property = DIProperty::newFromUserLabel('A un mot-clé', true); // inverse property
		$value = DIWikiPage::newFromTitle( $title );
		$description = new SomeProperty(
			$property,
			new ValueDescription($value)
		);

		$query = new \SMWQuery($description);
		$query->setLimit(100); // Adjust as needed

		// Use SMW Query API to execute the query
		$queryResult = $smwStore->getQueryResult( $query );
		
		$tags = [];

		foreach ($queryResult->getResults() as $result) {
			$relatedTitle = $result->getTitle();
			$tag = (String)$relatedTitle;
			$articleId = $relatedTitle->getArticleID();

			// Only add tags that are valid titles
			if ($articleId > 0) {
				$tags[] = $tag;
				$this->createTagForPage($tag, $articleId);
			}
		}

		return $tags;
	}
}
